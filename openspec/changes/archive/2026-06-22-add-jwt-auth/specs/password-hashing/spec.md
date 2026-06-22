## ADDED Requirements

### Requirement: Passwords are hashed with bcrypt cost factor 12

The system SHALL hash all passwords using bcrypt with a cost factor of 12 before storing them. Plaintext passwords MUST NOT be stored in the database under any circumstances.

#### Scenario: Registration hashes password with cost 12
- **WHEN** a user registers with password `"SecurePass123!"`
- **THEN** the stored `password_hash` is a bcrypt hash with cost factor 12
- **AND** the raw password string is not stored anywhere

#### Scenario: Password hash is not reversible
- **WHEN** a password hash is inspected in the database
- **THEN** it is not possible to derive the original plaintext password from the hash alone

---

### Requirement: Password verification uses bcrypt compare

The system SHALL verify passwords during login using `bcrypt.compare()` against the stored hash. Direct string comparison MUST NOT be used.

#### Scenario: Correct password verifies successfully
- **WHEN** `bcrypt.compare("SecurePass123!", storedHash)` is called with the correct plaintext password
- **THEN** the function returns `true`

#### Scenario: Wrong password fails verification
- **WHEN** `bcrypt.compare("WrongPassword", storedHash)` is called with an incorrect plaintext password
- **THEN** the function returns `false`