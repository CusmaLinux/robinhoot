## Why

The API needs a native JWT authentication system so users can log in, receive a signed access token, and authenticate subsequent requests. The auth service will be offered as the primary authentication mechanism for all users of the API.

## What Changes

- New `src/auth/` module replacing `src/users/`, owning user entity and authentication
- `POST /auth/register` — creates user with hashed password, returns user data (no auto-login)
- `POST /auth/login` — validates credentials, returns JWT access token
- `POST /auth/logout` — invalidates all user tokens via token version increment
- `POST /auth/login` and `POST /auth/register` are public (no guard applied)
- All other routes protected by JWT Auth Guard (global APP_GUARD)
- Database migration adds `password_hash` and `token_version` columns to users table
- User entity extended with `passwordHash` and `tokenVersion` fields

## Capabilities

### New Capabilities

- `user-auth`: Full authentication flow — login, register, logout with JWT access tokens, bcrypt password hashing, and token versioning for server-side logout invalidation.
- `jwt-access-token`: HS256-signed JWT access tokens containing `sub` (user ID), `email`, and `roles` claims with 15-minute expiry.
- `password-hashing`: Bcrypt hashing with cost factor 12 for safe password storage.
- `token-revocation`: Token versioning column on users table — increment on logout invalidates all existing tokens for that user without a denylist.
- `jwt-guard`: JWT Auth Guard applied globally via APP_GUARD, exempting `/auth/login` and `/auth/register` from token validation.

## Impact

- **New dependencies**: `@nestjs/jwt`, `bcrypt`
- **Database**: New migration `20260621T000000-add-auth-columns` adding `password_hash` (varchar) and `token_version` (integer, default 1) to users table
- **Removed**: `src/users/` entire folder (empty scaffolding and dead ORM artifacts)
- **Updated**: `src/database/database.types.ts`, `src/app.module.ts`, `src/main.ts`
- **New files**: Full auth module under `src/auth/` following hexagonal architecture (domain/application/infrastructure layers)