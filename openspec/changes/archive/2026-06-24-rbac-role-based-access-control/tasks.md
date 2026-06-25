## 1. Database Migration

- [ ] 1.1 Create migration to add `roles` JSONB column to `users` table with default `['user']`

## 2. Domain Layer

- [ ] 2.1 Create `UserRole` type and `ROLE_HIERARCHY` const in `src/auth/domain/value-objects/user-role.ts`
- [ ] 2.2 Update `UserEntity` to include `roles: UserRole[]` in constructor

## 3. Database Types

- [ ] 3.1 Update `src/database/database.types.ts` to add `roles: UserRole[]` to `UsersTable` interface

## 4. Roles Guard and Decorator

- [ ] 4.1 Create `@Roles()` decorator in `src/auth/infrastructure/adapters/in/roles.decorator.ts`
- [ ] 4.2 Create `RolesGuard` in `src/auth/infrastructure/adapters/in/roles.guard.ts` with hierarchical AND logic

## 5. JWT Auth Guard Update

- [ ] 5.1 Update `JwtAuthGuard` to attach `roles` to `request.user` from JWT payload

## 6. Application Services Updates

- [ ] 6.1 Update `LoginService` to include `roles` in JWT payload
- [ ] 6.2 Update `RegisterService` to set default `['user']` role on user creation

## 7. Auth Module Configuration

- [ ] 7.1 Register `RolesGuard` as global guard in `auth.module.ts` (after JwtAuthGuard)

## 8. Testing

- [ ] 8.1 Write unit tests for `RolesGuard` (hierarchical check logic)
- [ ] 8.2 Write unit tests for `@Roles()` decorator
- [ ] 8.3 Write unit tests for `UserRole` type and hierarchy functions
- [ ] 8.4 Update integration tests to verify roles in JWT payload