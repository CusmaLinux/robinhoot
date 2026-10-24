# JWT Access Token Specification

## Purpose

Describe issued account access tokens, their lifetime, and the application startup requirements that support the existing HTTP authentication contract.

## Requirements

### Requirement: Signing secret startup validation
The normal application bootstrap SHALL require JWT_SECRET to contain at least 32 characters and at least three of uppercase letters, lowercase letters, digits, and other characters. Missing, short, or insufficiently diverse secrets SHALL prevent startup.

#### Scenario: Accept a valid configured secret
- **GIVEN** JWT_SECRET meets the length and character-category requirements
- **WHEN** the application starts with its other dependencies available
- **THEN** signing-secret validation permits startup

#### Scenario: Reject an invalid configured secret
- **GIVEN** JWT_SECRET is missing, shorter than 32 characters, or contains fewer than three character categories
- **WHEN** the normal application bootstrap runs
- **THEN** startup fails with a configuration error

### Requirement: Issued token claims and signature
Successful login SHALL issue an HS256-signed access token using the configured secret. Its payload SHALL contain sub, email, roles, tokenVersion, iat, and exp. Identity and role claims SHALL reflect the account read at login, and exp SHALL be 900 seconds after iat.

#### Scenario: Login token payload
- **GIVEN** a stored account has an id, email, roles, and current token version
- **WHEN** that account logs in successfully
- **THEN** its token contains those account claims, issued/expiry timestamps 900 seconds apart, and an HS256 signature

### Requirement: Issued access token expiry
The API SHALL reject expired issued access tokens on protected HTTP handlers with 401 and message Unauthorized. A nonexpired token SHALL still require successful signature, existing-account, and token-version validation before authentication succeeds.

#### Scenario: Expired access token
- **GIVEN** an issued token's exp is in the past
- **WHEN** the client supplies it to a protected HTTP handler
- **THEN** the API returns 401 with message Unauthorized

#### Scenario: Nonexpired current token
- **GIVEN** a correctly signed nonexpired token identifies an existing account with a matching token version
- **WHEN** the client supplies it to a protected HTTP handler
- **THEN** authentication succeeds and any applicable role requirements are evaluated
