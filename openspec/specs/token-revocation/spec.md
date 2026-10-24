# Token Revocation Specification

## Purpose

Describe the existing persistent account token version that makes logout invalidate previously issued access tokens across all of an account's sessions.

## Requirements

### Requirement: Initial token version
Newly registered accounts SHALL have a token_version of 1. Successful login SHALL include the stored account version as tokenVersion in the issued access token.

#### Scenario: New account version
- **GIVEN** an email is not registered
- **WHEN** a client successfully registers and then logs in
- **THEN** the stored account version and issued tokenVersion are both 1

### Requirement: Persistent version validation
Every protected HTTP request SHALL look up the account identified by the verified token and compare its stored token_version with tokenVersion. A missing account or version mismatch SHALL return 401 with message Unauthorized even if the token has not expired.

#### Scenario: Token version mismatch
- **GIVEN** an account's stored version is 5 and its nonexpired token carries version 4
- **WHEN** the token is supplied to a protected HTTP handler
- **THEN** the API returns 401 with message Unauthorized

#### Scenario: Account no longer exists
- **GIVEN** a token has a valid signature but its subject no longer identifies a stored account
- **WHEN** it is supplied to a protected HTTP handler
- **THEN** the API returns 401 with message Unauthorized

### Requirement: Account-wide logout revocation
A successful authenticated logout SHALL increment the account's token_version by one. All tokens issued with the previous version SHALL subsequently fail protected HTTP authentication. A later login SHALL issue a token with the new version.

#### Scenario: Revoke multiple issued tokens
- **GIVEN** an account has two current tokens with the same version
- **WHEN** it successfully logs out using either token
- **THEN** both old tokens subsequently receive 401 on protected handlers

#### Scenario: Log in after revocation
- **GIVEN** logout incremented an account's stored token version
- **WHEN** the account logs in again with valid credentials
- **THEN** the new token carries the incremented version and can authenticate
