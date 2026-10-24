# User Authentication Specification

## Purpose

Describe the existing HTTP registration, login, and logout contract that API consumers use before the MVP quiz and live-game features are implemented.

## Requirements

### Requirement: Account registration
The API SHALL allow unauthenticated registration with a valid email and a password of 8–128 characters. Successful registration SHALL return 201 with only the account id and email, store a password hash, and SHALL NOT issue an access token. An email already found in storage SHALL cause 409 with the message Email already in use.

#### Scenario: Create an account
- **GIVEN** the submitted email is not already registered
- **WHEN** a client posts valid email and password fields to /auth/register
- **THEN** the API returns 201 with id and email and no accessToken or password fields

#### Scenario: Duplicate email
- **GIVEN** an account already exists for the submitted email
- **WHEN** a client posts valid registration data for that email
- **THEN** the API returns 409 with message Email already in use and creates no account

### Requirement: Authentication input validation
The normally bootstrapped HTTP API SHALL reject invalid registration or login DTO fields and unknown body properties with 400 validation errors. Registration SHALL reject caller-supplied roles rather than accepting self-assigned privileges. Login SHALL require a valid email and a nonempty string password.

#### Scenario: Invalid registration
- **GIVEN** the HTTP application has its normal global validation configuration
- **WHEN** a registration request omits required fields or supplies a password outside 8–128 characters
- **THEN** the API returns 400 with validation errors

#### Scenario: Caller attempts to assign roles
- **GIVEN** the HTTP application has its normal global validation configuration
- **WHEN** registration includes an additional roles property
- **THEN** the API returns 400 and does not create an account from that request

#### Scenario: Invalid login structure
- **GIVEN** the HTTP application has its normal global validation configuration
- **WHEN** a login request has an invalid email, an empty password, or an unknown property
- **THEN** the API returns 400 with validation errors

### Requirement: Account login
The API SHALL accept unauthenticated login at POST /auth/login. Correct credentials SHALL return 200 with an accessToken. An unknown email or incorrect password SHALL return 401 with the same message Invalid credentials, without returning an access token.

#### Scenario: Successful login
- **GIVEN** an account exists with the submitted email and password
- **WHEN** the client posts those credentials to /auth/login
- **THEN** the API returns 200 with accessToken

#### Scenario: Unsuccessful credentials
- **GIVEN** the request fields pass input validation
- **WHEN** the client submits an unknown email or the wrong password
- **THEN** the API returns 401 with message Invalid credentials in either case

### Requirement: Authenticated logout
POST /auth/logout SHALL identify the account from the validated bearer token, increment its token version, and return 200 with success true. The request SHALL require a valid token and SHALL NOT require a caller-supplied account id. Logout SHALL invalidate every previously issued token carrying the prior version for that account.

#### Scenario: Successful logout
- **GIVEN** the caller has a valid current access token
- **WHEN** the caller posts to /auth/logout with that bearer token
- **THEN** the API returns 200 with a success property equal to true and increments that account's token version

#### Scenario: Missing authentication
- **GIVEN** no bearer token is supplied
- **WHEN** the client posts to /auth/logout
- **THEN** the API returns 401 with message Unauthorized
