# Password Hashing Specification

## Purpose

Describe the existing password storage and verification behavior used by account registration and login without exposing password material to API consumers.

## Requirements

### Requirement: Hashed password storage
Registration SHALL persist a bcrypt password hash with cost factor 12 rather than the submitted plaintext password. The registration response SHALL contain neither the password nor its hash.

#### Scenario: Register with a password
- **GIVEN** valid registration input
- **WHEN** a new account is stored
- **THEN** its password_hash is a bcrypt hash with cost 12, plaintext is not a stored account field, and the response exposes neither password nor hash

### Requirement: Password comparison
Login SHALL verify a submitted password against the stored hash using bcrypt comparison. A matching password SHALL permit token issuance; a nonmatching password SHALL return the same generic Invalid credentials failure used for an unknown account.

#### Scenario: Matching password
- **GIVEN** a stored account and its bcrypt password hash
- **WHEN** login supplies the matching password
- **THEN** password comparison succeeds and the API issues an access token

#### Scenario: Nonmatching password
- **GIVEN** a stored account and its bcrypt password hash
- **WHEN** login supplies a nonmatching password
- **THEN** the API returns 401 with message Invalid credentials without issuing a token
