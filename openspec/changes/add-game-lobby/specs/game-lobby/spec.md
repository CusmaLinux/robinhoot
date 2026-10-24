# Spec Delta

## Purpose

Gather an authenticated quiz owner and guest players into a bounded classroom room with safe admission and recoverable lobby identity.

## ADDED Requirements

### Requirement: Owned room creation
The system SHALL let a quiz owner create one active room from a hostable quiz and SHALL freeze its question content and order. It SHALL reject an invalid quiz, a foreign quiz, or a second active room for the same owner.

#### Scenario: Freeze quiz
- **GIVEN** a professor owns a hostable quiz
- **WHEN** the professor creates a room and later edits or deletes the source quiz
- **THEN** the room retains its original playable content

#### Scenario: Invalid creation
- **GIVEN** a quiz is invalid, belongs to another user, or the owner already has an active room
- **WHEN** the user requests room creation
- **THEN** no additional room is created and a clear error is returned

### Requirement: PIN admission and limits
A room SHALL have a six-digit PIN unique among active rooms. New guest admission SHALL be limited to the lobby and thirty players. A nickname SHALL be trimmed, 1–20 characters long, and unique in the room ignoring case.

#### Scenario: Guest admission
- **GIVEN** a lobby has an available slot and nickname
- **WHEN** a guest submits its PIN and a valid nickname without an account
- **THEN** the guest receives an admission acknowledgement and subscribed host/guest sessions receive the updated safe roster

#### Scenario: Rejected join
- **GIVEN** a PIN is unknown, a room is closed or full, or a nickname is invalid or already used
- **WHEN** a guest attempts to join
- **THEN** the join is rejected with a clear error and no roster mutation

#### Scenario: Bounded join attempts
- **GIVEN** a client repeatedly submits PIN or admission attempts beyond the configured limit
- **WHEN** the client sends another attempt
- **THEN** the request is throttled without revealing whether a guessed nickname owns an existing session

### Requirement: Room-scoped guest identity
The system SHALL issue a private room-scoped guest credential on admission. Rejoining with a valid credential SHALL retain identity without consuming another slot. A PIN, nickname, or connection identifier alone SHALL NOT authorize takeover.

#### Scenario: Lobby reconnect
- **GIVEN** a guest has a valid credential for a live lobby
- **WHEN** the guest reconnects with that credential
- **THEN** the original roster identity is restored without duplicate entries

#### Scenario: Impersonation attempt
- **GIVEN** a guest knows another player's nickname or has a credential from a different room
- **WHEN** the guest attempts to restore that identity
- **THEN** the restore is rejected without exposing private credentials

#### Scenario: Safe roster
- **GIVEN** several guests have joined
- **WHEN** the host or a guest receives a roster update
- **THEN** it contains display information and connection status without other players' session credentials

### Requirement: Lobby lifecycle
An idle lobby SHALL expire thirty minutes after creation. The owner SHALL be able to cancel it. A disconnected host SHALL have 120 seconds to reauthenticate and restore ownership before automatic cancellation. Closed rooms SHALL reject admission and explain closure to connected participants.

#### Scenario: Idle expiry
- **GIVEN** a lobby has existed for thirty minutes without starting
- **WHEN** the expiry is reached
- **THEN** the lobby closes and its PIN no longer admits players

#### Scenario: Unauthorized host action
- **GIVEN** a guest or another account is connected
- **WHEN** it sends an owner-only cancellation or host-rejoin request
- **THEN** the action is rejected and the lobby remains unchanged

#### Scenario: Host returns
- **GIVEN** the host connection is lost
- **WHEN** the same owner reauthenticates within 120 seconds
- **THEN** the lobby resumes with its existing roster

#### Scenario: Host timeout
- **GIVEN** the owner has remained disconnected for 120 seconds
- **WHEN** the reconnect window expires
- **THEN** the room is cancelled and participants receive the reason
