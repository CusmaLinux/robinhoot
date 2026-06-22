## ADDED Requirements

### Requirement: User can register with email and password

The system SHALL allow unauthenticated users to create a new account by providing a valid email address and a password. Upon successful registration, the user SHALL be stored with a bcrypt-hashed password and a `token_version` of 1. Registration SHALL NOT automatically issue a token — the user MUST log in separately.

#### Scenario: Successful registration with new email
- **WHEN** a POST request to `/auth/register` is made with `{ "email": "alice@example.com", "password": "SecurePass123!" }`
- **THEN** a new user record is created with `email = alice@example.com`, `password_hash` set to a bcrypt hash of the password, and `token_version = 1`
- **AND** the response status is `201` with body `{ "id": "<uuid>", "email": "alice@example.com" }`

#### Scenario: Registration fails with already-used email
- **WHEN** a POST request to `/auth/register` is made with an email that already exists in the system
- **THEN** the response status is `409` with body `{ "message": "Email already in use" }`
- **AND** no new user record is created

#### Scenario: Registration fails with missing fields
- **WHEN** a POST request to `/auth/register` is made with a missing or empty email or password
- **THEN** the response status is `400` with a validation error

---

### Requirement: User can log in with email and password

The system SHALL allow unauthenticated users to log in by providing their email and password. On success, the system SHALL return a JWT access token containing the user's ID, email, and role. On failure, the system SHALL return a generic `401` message that does not reveal whether the email or password was wrong.

#### Scenario: Successful login
- **WHEN** a POST request to `/auth/login` is made with `{ "email": "alice@example.com", "password": "SecurePass123!" }`
- **THEN** the system verifies the password against the stored bcrypt hash
- **AND** the response status is `200` with body `{ "accessToken": "<jwt-string>" }`

#### Scenario: Login fails with wrong password
- **WHEN** a POST request to `/auth/login` is made with a valid email but wrong password
- **THEN** the response status is `401` with body `{ "message": "Invalid credentials" }`

#### Scenario: Login fails with non-existent email
- **WHEN** a POST request to `/auth/login` is made with an email that does not exist
- **THEN** the response status is `401` with body `{ "message": "Invalid credentials" }`

---

### Requirement: Authenticated user can log out

The system SHALL allow authenticated users to log out via `POST /auth/logout`. Logout SHALL increment the user's `token_version` in the database, thereby invalidating all existing tokens for that user.

#### Scenario: Successful logout
- **WHEN** a POST request to `/auth/logout` is made with a valid Authorization header containing a Bearer token
- **THEN** the system increments the `token_version` of the corresponding user by 1
- **AND** the response status is `200` with body `{ "message": "Logged out" }`

#### Scenario: Logout fails with missing token
- **WHEN** a POST request to `/auth/logout` is made without an Authorization header
- **THEN** the response status is `401` with body `{ "message": "Unauthorized" }`