## 1. Setup

- [x] 1.1 Install `@nestjs/jwt`, `bcrypt`, and `@types/bcrypt` dependencies
- [x] 1.2 Create `src/auth/` directory structure following hexagonal architecture
- [x] 1.3 Update `src/database/database.types.ts` — add `password_hash` (string) and `token_version` (number) to `UsersTable` interface
- [x] 1.4 Update `src/app.module.ts` — import `AuthModule`
- [x] 1.5 Update `src/main.ts` — read `JWT_SECRET` from env, throw if missing or shorter than 32 chars before app starts

## 2. Database Migration

- [x] 2.1 Create migration `20260621T000000-add-auth-columns.ts` in `src/database/migrations/`
- [x] 2.2 Migration adds `password_hash` (varchar, not null) and `token_version` (integer, not null, default 1) to users table
- [x] 2.3 Test migration runs successfully against the database

## 3. Domain Layer

- [x] 3.1 Create `src/auth/domain/entities/user.entity.ts` — class with `id`, `email`, `passwordHash`, `tokenVersion`, `createdAt` fields
- [x] 3.2 Create `src/auth/domain/value-objects/email.vo.ts` — email value object (currently empty, placeholder for validation)
- [x] 3.3 Create `src/auth/domain/events/user-created.event.ts` — event emitted on user creation (currently empty, placeholder)

## 4. Application Inbound Ports

- [x] 4.1 Create `src/auth/application/ports/in/login.use-case.ts` — `LoginInput` ({ email, password }), `LoginOutput` ({ accessToken })
- [x] 4.2 Create `src/auth/application/ports/in/register.use-case.ts` — `RegisterInput` ({ email, password }), `RegisterOutput` ({ id, email })
- [x] 4.3 Create `src/auth/application/ports/in/validate-token.use-case.ts` — `ValidatedToken` ({ userId, email, roles })
- [x] 4.4 Create `src/auth/application/ports/in/logout.use-case.ts` — `LogoutInput` ({ userId }), `LogoutOutput` ({ success })

## 5. Application Outbound Ports

- [x] 5.1 Create `src/auth/application/ports/out/jwt.service.port.ts` — `JwtServicePort` interface with `sign(payload): string` and `verify(token): JwtPayload`
- [x] 5.2 Create `src/auth/application/ports/out/bcrypt.service.port.ts` — `BcryptServicePort` interface with `hash(plain: string): Promise<string>` and `compare(plain: string, hash: string): Promise<boolean>`
- [x] 5.3 Create `src/auth/application/ports/out/user.repository.port.ts` — `UserRepositoryPort` interface with `findByEmail(email: string): Promise<UserEntity | null>`, `create(email: string, passwordHash: string): Promise<UserEntity>`, `bumpTokenVersion(userId: string): Promise<void>`

## 6. Application Services

- [x] 6.1 Create `src/auth/application/services/login.service.ts` — implements `LoginUseCase`, injects `UserRepositoryPort`, `BcryptServicePort`, `JwtServicePort`; on success signs JWT with { sub, email, roles, tokenVersion }
- [x] 6.2 Create `src/auth/application/services/register.service.ts` — implements `RegisterUseCase`, checks if email exists, hashes password, creates user via repo, returns { id, email }
- [x] 6.3 Create `src/auth/application/services/validate-token.service.ts` — implements `ValidateTokenUseCase`, verifies JWT with `JwtServicePort`, fetches user from repo by sub, compares tokenVersion with DB value, throws UnauthorizedException on mismatch
- [x] 6.4 Create `src/auth/application/services/logout.service.ts` — implements `LogoutUseCase`, calls `bumpTokenVersion` on the user repository

## 7. Infrastructure Outbound Adapters

- [x] 7.1 Create `src/auth/infrastructure/adapters/out/jwt-nestjs.adapter.ts` — implements `JwtServicePort` using `@nestjs/jwt` `JwtService`, inject via constructor
- [x] 7.2 Create `src/auth/infrastructure/adapters/out/bcrypt.adapter.ts` — implements `BcryptServicePort` using `bcrypt` with cost factor 12
- [x] 7.3 Create `src/auth/infrastructure/adapters/out/user.kysely.adapter.ts` — implements `UserRepositoryPort` using Kysely `KYSELY_INSTANCE`; `create()` inserts with `token_version = 1`, `bumpTokenVersion()` runs `UPDATE users SET token_version = token_version + 1 WHERE id = ?`

## 8. Infrastructure Inbound Adapters

- [x] 8.1 Create `src/auth/infrastructure/adapters/in/auth.controller.ts` — NestJS controller with `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` endpoints; uses `LoginUseCase`, `RegisterUseCase`, `LogoutUseCase`
- [x] 8.2 Create `src/auth/infrastructure/adapters/in/jwt-auth.guard.ts` — extends `AuthGuard('jwt')` from `@nestjs/passport`; overrides `canActivate()` to exempt `/auth/login` and `/auth/register` routes; calls `ValidateTokenUseCase` to verify token and check tokenVersion; attaches validated user to `request.user`
- [x] 8.3 Create `src/auth/infrastructure/adapters/in/current-user.decorator.ts` — `createParamDecorator` that extracts `request.user` as `{ userId, email, roles }`
- [x] 8.4 Register `JwtAuthGuard` as global APP_GUARD in the module providers

## 9. Auth Module Wiring

- [x] 9.1 Create `src/auth/infrastructure/auth.module.ts` — `@Module()` wiring all use cases, adapters, and the controller; provides `USER_REPOSITORY_PORT` → `UserKyselyAdapter`, `JWT_SERVICE_PORT` → `JwtNestJsAdapter`, `BCRYPT_SERVICE_PORT` → `BcryptAdapter`; exports `AuthModule`
- [x] 9.2 Verify all DI tokens are properly typed and no circular dependencies

## 10. Cleanup

- [x] 10.1 Delete entire `src/users/` folder (all subdirectories and files)
- [x] 10.2 Verify `app.module.ts` no longer references any `UsersModule` or user-related imports
- [x] 10.3 Verify `database.provider.ts` and `database.module.ts` remain intact and are the only database infrastructure

## 11. Verification

- [x] 11.1 Run `pnpm run build` — no TypeScript errors
- [x] 11.2 Run `pnpm run lint` — no lint errors
- [x] 11.3 Run `pnpm run test` — all unit tests pass (no tests exist, vacuous pass)
- [x] 11.4 Test `POST /auth/register` with a new email — returns 201 with id and email
- [x] 11.5 Test `POST /auth/register` with duplicate email — returns 409
- [x] 11.6 Test `POST /auth/login` with correct credentials — returns 200 with accessToken
- [x] 11.7 Test `POST /auth/login` with wrong password — returns 401
- [x] 11.8 Test `POST /auth/login` with non-existent email — returns 401
- [x] 11.9 Test `POST /auth/logout` with valid token — returns 200, increments token_version
- [x] 11.10 Test that old token is rejected after logout (tokenVersion mismatch)
- [x] 11.11 Test that a non-auth route (if any exist) returns 401 without token
- [x] 11.12 Test that `POST /auth/login` and `POST /auth/register` work without token