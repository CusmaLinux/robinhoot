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

#### Scenario: Retried creation
- **GIVEN** an owner created a room with a request UUID
- **WHEN** the same authenticated owner retries that request UUID and quiz UUID while the room exists
- **THEN** the original room metadata is returned without rereading the source or creating another room, including after source deletion

#### Scenario: Concurrent creation and PIN collision
- **GIVEN** concurrent creation requests and an allocator that may generate an active PIN
- **WHEN** rooms are created across awaited quiz reads
- **THEN** each owner has at most one room, active PINs are never overwritten, allocation retries are bounded, and failed creation leaves no owner reservation

#### Scenario: Safe creation response and host identity
- **GIVEN** an authenticated quiz owner creates a room
- **WHEN** creation succeeds
- **THEN** the response contains only room ID, string PIN, phase, revision, and creation time, while the host is privately bound to the verified account ID rather than client-supplied identity or PIN

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

#### Scenario: Live connection replacement
- **GIVEN** a guest is still connected to a lobby
- **WHEN** a fresh connection restores with that guest's room credential
- **THEN** the identity retains one slot, the new connection owns it, and the old connection cannot sync, replay its join receipt, acquire another identity, or mark the replacement offline on disconnect

#### Scenario: Retried restoration
- **GIVEN** a connection currently owns a restored guest session
- **WHEN** it retries restoration with the same room credential
- **THEN** the current safe state is returned without another revision or roster slot

### Requirement: Consistent subscribed state
The system SHALL complete room subscription before synchronously rechecking authority and capturing a current safe snapshot for admission, restoration, host binding, or state synchronization. Bound guests SHALL use their current server connection authority; bound hosts SHALL revalidate their account token and ownership. Snapshots and broadcasts SHALL carry monotonically increasing room revisions.

#### Scenario: Mutation during subscription
- **GIVEN** a client's room subscription is pending
- **WHEN** another client mutates the roster before subscription completes
- **THEN** the acknowledgement includes that mutation and the established subscription delivers later roster events

#### Scenario: Superseded subscription
- **GIVEN** a restoring guest is waiting for subscription
- **WHEN** another connection successfully restores the same guest
- **THEN** the superseded operation returns SESSION_REPLACED, removes its subscription, and cannot regain the guest's authority

#### Scenario: Unauthorized state synchronization
- **GIVEN** a connection is unbound, targets another room, has been replaced, or is a host with a revoked token
- **WHEN** it requests state.sync
- **THEN** it receives an authorization error without a room snapshot

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
