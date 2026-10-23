# HTTP JWT Authentication Specification

## Purpose

Define the current default authentication boundary for registered HTTP controller handlers and the validated identity available to downstream request handling.

## Requirements

### Requirement: Protected HTTP handlers by default
Registered HTTP controller handlers SHALL require valid bearer authentication unless marked public. POST /auth/register and POST /auth/login SHALL be public. This boundary SHALL NOT imply authentication of middleware-served documentation or unimplemented WebSocket handlers.

#### Scenario: Public authentication endpoints
- **GIVEN** a client has no bearer token
- **WHEN** it submits valid registration or login requests
- **THEN** the requests reach their authentication use cases without a missing-token rejection

#### Scenario: Protected handler without a token
- **GIVEN** a registered HTTP handler is not public
- **WHEN** a client calls it without bearer authentication
- **THEN** the API returns 401 with message Unauthorized

### Requirement: Bearer credential extraction
Protected HTTP requests SHALL supply an Authorization header beginning with the literal prefix Bearer followed by a space and the token. Missing, malformed, invalidly signed, or unverifiable credentials SHALL result in 401 with message Unauthorized.

#### Scenario: Unsupported authorization format
- **GIVEN** a protected HTTP handler
- **WHEN** a client supplies no header or an authorization value without the expected Bearer prefix
- **THEN** the API returns 401 with message Unauthorized

#### Scenario: Token verification failure
- **GIVEN** a protected HTTP handler
- **WHEN** the client supplies a malformed token or one that fails signature verification
- **THEN** the API returns 401 with message Unauthorized

### Requirement: Validated request identity
After token verification, account existence, and token-version checks, the API SHALL expose userId, email, and roles from the token claims to HTTP handlers. The account identity used for logout SHALL come from that validated identity rather than a caller-provided body field.

#### Scenario: Authenticated handler identity
- **GIVEN** a current token identifies an existing account
- **WHEN** authentication succeeds
- **THEN** downstream handling receives the token's subject as userId and its email and roles claims

#### Scenario: Caller submits another account id
- **GIVEN** a caller has a valid token for account A
- **WHEN** it calls logout with a body that names account B
- **THEN** logout acts on the authenticated account A rather than account B
