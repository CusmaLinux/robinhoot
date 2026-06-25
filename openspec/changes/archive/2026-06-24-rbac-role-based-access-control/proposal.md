## Why

Currently all protected endpoints require only a valid JWT, with no role-based access control. As the platform grows, we need to restrict certain actions to specific roles (e.g., admin-only endpoints) while keeping user-level access for regular authenticated users.

## What Changes

- Add `roles` JSONB column to `users` table with default value `['user']`
- Create `UserRole` type (`'user' | 'admin'`) with hierarchy: `admin` > `user`
- Create `@Roles()` decorator for marking controller methods with required roles
- Create `RolesGuard` (global) to enforce role requirements using hierarchical AND logic
- Update `JwtAuthGuard` to attach user roles to request object
- Include roles in JWT payload on login for stateless role checks
- Registration automatically assigns `['user']` role

## Capabilities

### New Capabilities

- `user-roles`: Role-based access control for API endpoints. Allows protecting routes with `@Roles()` decorator. Roles are hierarchical (admin inherits user permissions). Roles stored as JSONB in users table and embedded in JWT for stateless checks.

### Modified Capabilities

- (none - auth behavior is additive)

## Impact

- **Database**: New `roles` column added to `users` table
- **Auth Module**: New decorator and guard; modified JWT payload
- **Registration**: Default role assignment on new user creation
- **All Controllers**: Can use `@Roles()` decorator to protect endpoints

## Rollback Plan

1. Remove global `RolesGuard` from `auth.module.ts`
2. Delete `@Roles()` decorator and `roles.guard.ts`
3. Revert migration to remove `roles` column from users table
4. Remove `roles` from JWT payload in `login.service.ts`
5. Remove `UserRole` type from codebase

All changes are additive; no existing functionality is modified except JWT payload gaining a `roles` field.