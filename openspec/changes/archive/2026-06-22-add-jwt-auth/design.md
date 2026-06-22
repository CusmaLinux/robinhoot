## Context

The project is a NestJS 11 API using hexagonal architecture with Kysely (not an ORM) for Postgres. User management currently exists as empty scaffolding under `src/users/` with a `UserEntity` that only has `id`, `email`, and `createdAt`. The `UsersTable` in `database.types.ts` only has those three columns. The `users/` folder contains dead ORM artifacts (empty persistence adapter files) and a non-functional module. The app module is empty — nothing is wired.

Authentication is not implemented. The goal is to add a complete JWT auth system where:
- Users can register with email + password
- Users can log in and receive a signed JWT access token
- Users can log out (server-side token invalidation)
- All other endpoints are protected by a global JWT guard

## Goals / Non-Goals

**Goals:**
- Full login / register / logout flow
- JWT access tokens with email and roles in claims
- Bcrypt password hashing (cost 12)
- Server-side logout via token versioning (no denylist table)
- Global JWT guard protecting all routes except `/auth/login` and `/auth/register`
- Hexagonal architecture for auth module (ports/adapters)
- Auth module owns the user entity (replaces `src/users/` entirely)

**Non-Goals:**
- Refresh tokens (access token only, 15-minute TTL)
- Token revocation for stolen tokens (15-min exposure window accepted)
- Refresh-token-based re-login after role change
- Multi-role support beyond a simple single-role enum per user
- User profile management endpoints
- Social / OAuth login

## Decisions

### 1. Auth module owns user entity, replaces `src/users/`

The `users/` folder is half-built with empty files and dead ORM scaffolding. Since auth needs full control over the user entity (password hash, token version), the cleanest approach is to delete `src/users/` entirely and build the user entity under `src/auth/domain/entities/user.entity.ts`.

**Alternatives considered:**
- Keep `users/` for user data, create a separate `auth/` for JWT concerns → split ownership of the user entity across two modules. User entity would live in `users/`, auth services would reference it. This creates coupling and the existing `users/` is mostly dead code anyway.
- Merge auth into a combined module later if needed → unnecessary indirection.

**Decision:** Delete `src/users/` entirely. Build user entity under auth.

---

### 2. Token versioning for server-side logout (not a denylist)

Logout increments a `token_version` column on the user row. Tokens carry the `token_version` in their claims. On every protected request, the guard verifies the token's `token_version` matches the DB value. A mismatch means the token is invalid.

**Alternatives considered:**
- Token denylist table: store expired JTIs in a DB table, check on every request. Adds a DB write on logout and a DB read on every protected request.
- Redis-based denylist: faster than DB but adds infrastructure dependency.
- No server-side logout: client discards token, accept 15-min exposure. User explicitly rejected this.

**Decision:** Token versioning (approach B). One integer column on users, no extra table, single DB read on token validation.

---

### 3. HS256 JWT signed with `@nestjs/jwt`

The secret is stored in `process.env.JWT_SECRET`, minimum 32 characters. The token payload contains:
```json
{ "sub": "<user-id>", "email": "<email>", "roles": ["<role>"], "tokenVersion": 1, "iat": ..., "exp": ... }
```

**Alternatives considered:**
- RS256 (asymmetric): adds key pair management complexity. Overkill for a single-service API.
- Raw `jsonwebtoken` without `@nestjs/jwt`: more manual wiring, same underlying crypto. `@nestjs/jwt` integrates with NestJS DI cleanly.

**Decision:** HS256 via `@nestjs/jwt`. Secret from env, not hardcoded.

---

### 4. Bcrypt cost factor 12

Passwords hashed with `bcrypt.hash(password, 12)`. Verification via `bcrypt.compare`.

**Alternatives considered:**
- Cost 10 (bcrypt default): acceptable in 2024, but 2026+ workload suggests 12 for better margin.
- Argon2: more modern, but requires `argon2` library. Bcrypt is battle-tested, well-understood by the team.

**Decision:** Bcrypt cost 12. Wrapped behind a `BcryptServicePort` outbound port.

---

### 5. Global APP_GUARD with route exemptions

The `JwtAuthGuard` is registered as a global guard via `APP_GUARD`. In the guard's `canActivate()`, public routes (`/auth/login`, `/auth/register`) are exempted by checking the route path. No route-level metadata needed.

**Alternatives considered:**
- Route-level `@Public()` decorator with a metadata key: requires setting up a custom decorator and checking it in the guard. More NestJS-idiomatic but more moving parts.
- Exempt specific paths in guard's `canActivate`: simple `if (path.startsWith('/auth/')) return true`. Works for this scope.

**Decision:** Global guard, exemption by path check in guard. Keep it simple.

---

### 6. Hexagonal ports structure for auth

```
src/auth/
├── domain/entities/user.entity.ts         ← id, email, passwordHash, tokenVersion, createdAt
├── application/ports/in/
│   ├── login.use-case.ts
│   ├── register.use-case.ts
│   ├── validate-token.use-case.ts
│   └── logout.use-case.ts
├── application/ports/out/
│   ├── jwt.service.port.ts
│   ├── bcrypt.service.port.ts
│   └── user.repository.port.ts
├── application/services/
│   ├── login.service.ts
│   ├── register.service.ts
│   ├── validate-token.service.ts
│   └── logout.service.ts
└── infrastructure/adapters/
    ├── in/ (auth.controller.ts, jwt-auth.guard.ts, current-user.decorator.ts)
    └── out/ (jwt-nestjs.adapter.ts, bcrypt.adapter.ts, user.kysely.adapter.ts)
```

**Alternatives considered:**
- Auth service inside a controller without ports: violates hexagonal principle, harder to test, couples business logic to HTTP.
- Skip outbound ports for JWT/bcrypt: these are infrastructure details that should be swappable. Ports keep the use cases framework-agnostic.

**Decision:** Full hexagonal layering. Use cases depend on port interfaces; adapters implement them.

---

## Risks / Trade-offs

**[Risk] JWT secret must be set in environment — no default**
If `JWT_SECRET` is missing, the app should fail fast at startup (throw in `main.ts`). A missing secret with a fallback is a security risk.

**[Risk] Token stolen within 15-minute window**
If a token is stolen, the attacker has up to 15 minutes of access. For this project, revocation on stolen tokens is out of scope. User accepts this tradeoff.

**[Risk] Role change requires re-login**
Embedding roles in the JWT means a role change (promotion, demotion) requires the user to log in again to get a new token. This is acceptable per the project requirements.

**[Risk] Logout increments user row on every request**
Logout touches the users table (UPDATE token_version). With Approach B and a single Postgres instance, this is acceptable. For a distributed multi-instance deployment, this would be a different discussion.

**[Risk] No registration rate limiting**
`POST /auth/register` is public. An attacker could spam it. No rate limiting is in scope for this design, but it's worth noting for production hardening.

## Migration Plan

1. Install dependencies: `pnpm add @nestjs/jwt bcrypt && pnpm add -D @types/bcrypt`
2. Create migration `20260621T000000-add-auth-columns` — adds `password_hash` and `token_version` columns
3. Update `database.types.ts` — add new columns to `UsersTable` interface
4. Build auth module files (domain → application ports → application services → infrastructure adapters)
5. Update `app.module.ts` — import `AuthModule`
6. Update `main.ts` — read `JWT_SECRET`, throw if missing
7. Delete `src/users/` entirely
8. Run migration and verify schema
9. Test login, register, logout flows end-to-end

**Rollback:** Roll back the migration to remove `password_hash` and `token_version` columns. Revert to `app.module.ts` before auth import. Restore `src/users/` from git if needed.

## Open Questions

1. **Should `token_version` start at 0 or 1?** Currently set to 1 on user creation. If 0, first login token would have `tokenVersion: 0` — mismatch with DB 0 until first bump. Using 1 as default avoids this edge case at creation time.

2. **What happens if registration tries to create a user with an already-used email?** The `register` use case checks `findByEmail` first and throws a conflict-style error. 409 response with generic message.

3. **Should the UserCreated event be published on registration?** The existing `user-created.event.ts` exists in the domain events folder. For now, registration does not publish events — just creates the user silently. This can be added later.

4. **Is there a roles enum defined somewhere?** Not yet. The roles column will be a simple string (`varchar`) stored directly in the users table. No enum type in the DB — just a `string` in the entity and JWT claim. Roles are single-value (one role per user per the proposal decision).