## ADDED Requirements

### Requirement: Roles are stored as JSONB in users table

The system SHALL store user roles in a `roles` JSONB column on the `users` table. The column SHALL default to `['user']` for new users.

#### Scenario: New user has default user role

- **WHEN** a new user registers via `POST /auth/register`
- **THEN** the user's `roles` column SHALL be set to `['user']`

#### Scenario: Roles column accepts multiple roles

- **WHEN** a user is created or updated with roles `['admin', 'user']`
- **THEN** the `roles` column SHALL store the complete array as valid JSONB

### Requirement: UserRole type with role hierarchy

The system SHALL define a `UserRole` type as the union `'user' | 'admin'`. Role hierarchy SHALL be `admin` > `user`, meaning `admin` role implicitly includes all `user` role permissions.

#### Scenario: Admin role inherits user permissions

- **WHEN** a user with role `['admin']` attempts to access an endpoint protected with `@Roles(['user'])`
- **THEN** the request SHALL be allowed

#### Scenario: User role does not inherit admin permissions

- **WHEN** a user with role `['user']` attempts to access an endpoint protected with `@Roles(['admin'])`
- **THEN** the request SHALL be denied with 403 Forbidden

### Requirement: Roles decorator marks required roles

The system SHALL provide a `@Roles()` decorator that accepts an array of `UserRole` values. The decorator SHALL be applicable to controller methods.

#### Scenario: Single role requirement

- **WHEN** a controller method is decorated with `@Roles(['admin'])`
- **THEN** the decorator metadata SHALL store `['admin']` as required roles

#### Scenario: Multiple role requirement (AND logic)

- **WHEN** a controller method is decorated with `@Roles(['admin', 'user'])`
- **THEN** the decorator metadata SHALL store `['admin', 'user']` as required roles
- **AND** the user SHALL be required to have BOTH roles or a role that inherits both

### Requirement: RolesGuard enforces role requirements

The RolesGuard SHALL be registered as a global NestJS guard that runs after JwtAuthGuard. The guard SHALL:

1. Extract `@Roles()` metadata from the route handler
2. If no `@Roles()` metadata exists, allow the request to proceed
3. If `@Roles()` metadata exists, retrieve user roles from `request.user.roles`
4. Verify the user has all required roles using hierarchical AND logic

#### Scenario: No @Roles decorator allows all authenticated users

- **WHEN** a controller method has no `@Roles()` decorator
- **THEN** any authenticated user SHALL be allowed access

#### Scenario: User has all required roles

- **WHEN** user has roles `['user', 'admin']`
- **AND** endpoint requires `@Roles(['admin'])`
- **THEN** the request SHALL be allowed

#### Scenario: User has some but not all required roles

- **WHEN** user has roles `['user']`
- **AND** endpoint requires `@Roles(['admin', 'user'])`
- **THEN** the request SHALL be denied with 403 Forbidden

#### Scenario: Hierarchical role satisfies lower role requirement

- **WHEN** user has roles `['admin']`
- **AND** endpoint requires `@Roles(['user'])`
- **THEN** the request SHALL be allowed (admin inherits user)

### Requirement: Roles are embedded in JWT payload

The system SHALL include user roles in the JWT payload on successful login. The JWT payload SHALL include `roles: string[]` containing the user's current roles.

#### Scenario: Login returns JWT with roles

- **WHEN** user successfully logs in via `POST /auth/login`
- **THEN** the returned access token SHALL contain a `roles` field with the user's roles

#### Scenario: JWT roles used for stateless role checking

- **WHEN** JwtAuthGuard validates a JWT
- **THEN** the guard SHALL attach the JWT's `roles` field to `request.user.roles`
- **AND** RolesGuard SHALL use these roles for authorization

### Requirement: Registration assigns default user role

The registration flow SHALL automatically assign the `['user']` role to new users. No mechanism SHALL exist for users to self-assign roles.

#### Scenario: New user registration has user role

- **WHEN** user calls `POST /auth/register` with valid email and password
- **THEN** the created user SHALL have roles `['user']`

#### Scenario: Registration does not allow role specification

- **WHEN** user calls `POST /auth/register` with a roles field in the request body
- **THEN** the roles field SHALL be ignored and default `['user']` SHALL be used