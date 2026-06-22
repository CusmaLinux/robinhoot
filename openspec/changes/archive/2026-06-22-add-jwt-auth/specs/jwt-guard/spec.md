## ADDED Requirements

### Requirement: All routes are protected by JWT Auth Guard by default

The system SHALL apply the JWT Auth Guard to all routes in the application. Any request without a valid Bearer token SHALL be rejected with `401 Unauthorized`.

#### Scenario: Request without token is rejected
- **WHEN** a request is made to any protected route without an Authorization header
- **THEN** the response status is `401` with body `{ "message": "Unauthorized" }`

#### Scenario: Request with invalid token is rejected
- **WHEN** a request is made to any protected route with an invalid or malformed Bearer token
- **THEN** the response status is `401` with body `{ "message": "Unauthorized" }`

#### Scenario: Request with valid token is allowed
- **WHEN** a request is made to a protected route with a valid, non-expired JWT that passes all validation checks
- **THEN** the request is processed normally

---

### Requirement: /auth/login and /auth/register are public and not protected

The system SHALL exempt `POST /auth/login` and `POST /auth/register` from JWT authentication. These routes MUST be accessible without a token.

#### Scenario: POST /auth/login is accessible without token
- **WHEN** a request is made to `POST /auth/login` without an Authorization header
- **THEN** the response is either `200` (success) or `401` (invalid credentials), never `401` due to missing token

#### Scenario: POST /auth/register is accessible without token
- **WHEN** a request is made to `POST /auth/register` without an Authorization header
- **THEN** the response is either `201` (success) or `409/400` (conflict/validation), never `401` due to missing token

---

### Requirement: Guard extracts and validates Bearer token from Authorization header

The JWT Auth Guard SHALL extract the token from the `Authorization` header in the format `Bearer <token>`. If the header is missing, malformed, or does not start with "Bearer ", the guard SHALL reject the request.

#### Scenario: Malformed Authorization header is rejected
- **WHEN** a request is made with `Authorization: NotBearer sometoken`
- **THEN** the response status is `401` with body `{ "message": "Unauthorized" }`

---

### Requirement: Validated user is attached to request object

After successfully validating a JWT token and verifying the tokenVersion, the JWT Auth Guard SHALL attach the validated user payload to the incoming request object so that it is available to downstream handlers via the `CurrentUser` decorator.

#### Scenario: CurrentUser decorator returns validated user
- **WHEN** a protected request is made with a valid token for user `{ "sub": "uuid", "email": "alice@example.com", "roles": ["user"] }`
- **THEN** the `CurrentUser()` decorator in the controller returns `{ userId: "uuid", email: "alice@example.com", roles: ["user"] }`