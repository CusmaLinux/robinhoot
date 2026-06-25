## Context

The authentication system uses JWT with 15-minute expiry. All protected endpoints require only a valid JWT — there is no role-based access control. The JWT payload already contains a `roles: string[]` field but it is always empty.

Users table has: `id, email, password_hash, token_version, created_at`. Database is PostgreSQL with Kysely SQL query builder.

The platform needs to restrict certain endpoints to admin users while keeping user-level access for regular authenticated users.

## Goals / Non-Goals

**Goals:**
- Enable protecting controller endpoints with `@Roles()` decorator
- Support multiple roles per user (e.g., `['user', 'admin']`)
- Implement role hierarchy where higher roles include lower role permissions
- Stateless role verification via JWT (no per-request DB hit for roles)

**Non-Goals:**
- Dynamic role assignment after registration (admin manually assigns roles)
- Role-based content filtering (only endpoint protection)
- Multiple role schemas or extensible role system (only 'user' and 'admin')

## Decisions

### 1. Roles stored as JSONB in users table

**Decision:** Single `roles` JSONB column with array of role strings.

**Rationale:** With only 2-3 roles, the complexity of a junction table is unnecessary. JSONB provides:
- Fast reads (no JOINs)
- Simple query patterns (`WHERE roles @> '["admin"]'`)
- Natural fit for multi-role cardinality

**Alternatives considered:**
- Junction table (normalized, more complex queries)
- Single role enum column (doesn't support multi-role requirement)

### 2. Global RolesGuard (not per-route)

**Decision:** `RolesGuard` registered as global NestJS guard alongside `JwtAuthGuard`.

**Rationale:**
- Single guard registration covers all endpoints
- `@Roles()` decorator on specific methods provides opt-in enforcement
- Guard skips check if no `@Roles()` metadata present (pass-through behavior)
- Consistent with global `JwtAuthGuard` pattern already established

**Alternatives considered:**
- Per-route `@UseGuards(RolesGuard)` — adds boilerplate to every protected controller
- Combined JwtAuthGuard + RolesGuard in single class — violates single responsibility

### 3. Roles embedded in JWT (stateless)

**Decision:** User roles are included in JWT payload on login; `RolesGuard` reads from JWT.

**Rationale:**
- No extra DB query per request (roles already attached to request by JwtAuthGuard)
- Consistent with existing auth pattern where JwtAuthGuard handles both validation and user attachment
- Trade-off: role changes require token refresh (logout/login) — acceptable given roles rarely change

**Alternatives considered:**
- Stateful: fetch roles from DB on every request — extra latency, but always current
- Cache roles in Redis with invalidation — adds infrastructure complexity

### 4. Hierarchical AND logic for role checking

**Decision:** `@Roles(['admin', 'user'])` requires user to have BOTH roles (or a role that inherits both).

**Rationale:**
- AND logic is explicit: developer states exact requirements
- Hierarchy allows "admin" to implicitly satisfy "user" requirement
- Simple implementation: check if user's highest role >= required role for each requirement

**Role Hierarchy:** `admin` > `user` (admin inherits user permissions)

```typescript
const ROLE_HIERARCHY = ['admin', 'user'] as const;

function hasRequiredRole(userRoles: UserRole[], required: UserRole): boolean {
  const requiredIdx = ROLE_HIERARCHY.indexOf(required);
  return userRoles.some(ur => ROLE_HIERARCHY.indexOf(ur) >= requiredIdx);
}

function hasAllRoles(userRoles: UserRole[], required: UserRole[]): boolean {
  return required.every(r => hasRequiredRole(userRoles, r));
}
```

### 5. UserRole type (not enum)

**Decision:** `type UserRole = 'user' | 'admin'` with const assertion on hierarchy array.

**Rationale:**
- Kysely does not support TypeScript enums directly
- String literal union provides type safety without enum overhead
- Const assertion ensures ROLE_HIERARCHY array is readonly tuple, not string[]

## Risks / Trade-offs

**[Risk] Role changes not reflected until token expiry**
- JWT roles become stale after role modifications until logout/login
- **Mitigation:** Document that role changes require user re-authentication; 15-minute JWT expiry limits staleness window

**[Risk] JSONB querying less expressive than relational**
- Cannot easily query "users with role X" using Kysely's query builder
- **Mitigation:** For admin queries, use raw SQL or Kysely's `.sql()` template for JSONB operators (`@>`)

**[Risk] No way to assign roles during registration**
- Registration always assigns `['user']` role; no mechanism for initial admin
- **Mitigation:** First admin can be set via database migration/scripts, not self-service

## Migration Plan

1. **Create migration** for `roles` column with default `['user']`
2. **Create** `UserRole` type, `@Roles()` decorator, `RolesGuard`
3. **Update** `JwtAuthGuard` to attach roles to request.user
4. **Update** `LoginService` to include roles in JWT payload
5. **Update** `RegisterService` to set default roles `['user']`
6. **Deploy** all changes together (all are additive)
7. **Verify** existing login/registration flows work unchanged
8. **Test** `@Roles()` decorator on a new endpoint

## Open Questions

**(none — all decisions made during exploration)**

## Request Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Full Request Flow                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Request                                                            │
│     │                                                               │
│     ▼                                                               │
│  ┌──────────────────────┐  ┌───────────────────────────────────┐    │
│  │   JwtAuthGuard       │  │ • Extract Authorization header    │    │
│  │   (global)           │─▶│ • Validate JWT + token version    │    │
│  │                      │  │ • Attach request.user             │    │
│  │                      │  │   { userId, email, roles: [...] } │    │
│  └──────────────────────┘  └───────────────────────────────────┘    │
│     │                                                               │
│     ▼                                                               │
│  ┌──────────────────────┐  ┌───────────────────────────────────┐    │
│  │   RolesGuard         │  │ • Read @Roles(['admin']) metadata │    │
│  │   (global)           │─▶│ • If no @Roles → pass             │    │
│  │                      │  │ • Check hasAllRoles(userRoles,    │    │
│  │                      │  │   required) with hierarchy        │    │
│  └──────────────────────┘  └───────────────────────────────────┘    │
│     │                                                               │
│     ▼                                                               │
│  Controller action                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```
