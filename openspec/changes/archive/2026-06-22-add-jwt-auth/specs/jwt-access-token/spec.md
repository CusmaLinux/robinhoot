## ADDED Requirements

### Requirement: JWT access token is HS256 signed

The system SHALL sign JWT access tokens using the HS256 algorithm with a secret key sourced from the `JWT_SECRET` environment variable. The secret MUST be at least 32 characters. The app MUST throw an error and refuse to start if `JWT_SECRET` is missing or too short.

#### Scenario: App starts with valid JWT_SECRET
- **WHEN** the application starts with `JWT_SECRET` set to a string of 32 or more characters
- **THEN** the application starts successfully

#### Scenario: App refuses to start without JWT_SECRET
- **WHEN** the application starts with `JWT_SECRET` unset
- **THEN** the application throws an error during initialization and does not start

---

### Requirement: JWT payload contains sub, email, roles, and tokenVersion

The JWT access token payload SHALL contain the following claims:
- `sub`: the user's UUID string
- `email`: the user's email address
- `roles`: an array containing the user's role string
- `tokenVersion`: the user's current token version integer (from the database)
- `iat`: issued-at timestamp (added by @nestjs/jwt automatically)
- `exp`: expiration timestamp (added by @nestjs/jwt automatically, set to 15 minutes after `iat`)

#### Scenario: Token contains correct claims
- **WHEN** a user successfully logs in
- **THEN** the returned JWT payload contains `sub`, `email`, `roles`, `tokenVersion`, `iat`, and `exp` claims

---

### Requirement: JWT expires after 15 minutes

The JWT access token SHALL expire 15 minutes after issuance. After expiration, the token is no longer valid for authenticated requests.

#### Scenario: Token is rejected after expiry
- **WHEN** a request is made with an expired JWT (past the `exp` claim)
- **THEN** the response status is `401` with body `{ "message": "Unauthorized" }`

#### Scenario: Token is accepted within 15-minute window
- **WHEN** a request is made with a valid, non-expired JWT
- **THEN** the request is processed normally