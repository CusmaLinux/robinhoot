# User Roles Specification

## Purpose

Describe existing account roles and HTTP handler authorization independently from the future quiz ownership and live-room ownership rules.

## Requirements

### Requirement: Default account role
Registration SHALL assign the user role without permitting callers to select roles. Stored account roles SHALL be a JSONB array defaulting to user. The normal HTTP registration boundary SHALL reject an additional roles property with 400.

#### Scenario: Default role
- **GIVEN** valid registration data without a roles property
- **WHEN** the account is created
- **THEN** its stored roles array contains user

#### Scenario: Self-assignment rejected
- **GIVEN** the normal global HTTP input validation is active
- **WHEN** a caller adds roles containing admin to registration
- **THEN** the API rejects the request with 400 and creates no account from it

### Requirement: Hierarchical HTTP role requirements
For HTTP route handlers with role requirements, authorization SHALL require every listed role to be satisfied. Admin SHALL satisfy both admin and user requirements; user SHALL NOT satisfy admin. Failing role requirements after successful authentication SHALL return 403 with message Insufficient permissions.

#### Scenario: Admin satisfies a user requirement
- **GIVEN** the authenticated identity has the admin role
- **WHEN** a handler requires user
- **THEN** role authorization permits the request

#### Scenario: User cannot satisfy an admin requirement
- **GIVEN** the authenticated identity has only user
- **WHEN** a handler requires admin or requires both admin and user
- **THEN** the API returns 403 with message Insufficient permissions

#### Scenario: Admin satisfies combined requirements
- **GIVEN** the authenticated identity has admin
- **WHEN** a handler requires both admin and user
- **THEN** role authorization permits the request

### Requirement: No additional handler role restriction
A registered protected HTTP handler without declared role requirements SHALL impose no role restriction beyond the normal authentication checks. Public authentication handlers without role requirements SHALL remain callable without an account token.

#### Scenario: Authenticated handler without role requirements
- **GIVEN** a current authenticated user
- **WHEN** the user calls a protected handler with no role requirements
- **THEN** the role check permits processing

### Requirement: Login-time role claims
Successful login SHALL copy stored account roles into the issued JWT. HTTP authorization SHALL use the verified token's roles after account existence and token-version checks; it SHALL NOT refresh role claims from storage during each request. Changing stored roles alone SHALL NOT change an already-issued token's role claims.

#### Scenario: Stored role changes after issuance
- **GIVEN** a token was issued with user and its account version remains unchanged
- **WHEN** stored roles later become admin and the old token calls an admin-restricted handler
- **THEN** its user claim still fails authorization with 403 until a suitable new token is issued
