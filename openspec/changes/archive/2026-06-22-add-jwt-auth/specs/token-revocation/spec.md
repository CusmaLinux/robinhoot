## ADDED Requirements

### Requirement: Logout increments user token_version

The system SHALL increment the `token_version` column of the user record in the database when a user logs out. This increment invalidates all existing JWT access tokens for that user because each token carries the `tokenVersion` in its claims.

#### Scenario: Logout bumps token_version
- **WHEN** a user with `token_version = 3` calls `POST /auth/logout`
- **THEN** the database is updated so that user's `token_version = 4`

---

### Requirement: Validated token is rejected if tokenVersion does not match database

The system SHALL compare the `tokenVersion` claim in the JWT with the `token_version` stored in the user's database record on every protected request. If the values do not match, the request SHALL be rejected with `401 Unauthorized`.

#### Scenario: Token rejected after logout (version mismatch)
- **WHEN** a user has `token_version = 5` in the database but a token with `tokenVersion = 4` in its claims
- **THEN** a request using that token returns `401 Unauthorized`

#### Scenario: Token accepted when versions match
- **WHEN** a user has `token_version = 5` in the database AND a token with `tokenVersion = 5` in its claims
- **THEN** the request is processed normally

---

### Requirement: Token version starts at 1 on user creation

Newly registered users SHALL have their `token_version` set to `1` in the database. The value 0 is not used as an initial version.

#### Scenario: New user has token_version of 1
- **WHEN** a new user is created via `POST /auth/register`
- **THEN** the user's `token_version` in the database is `1`