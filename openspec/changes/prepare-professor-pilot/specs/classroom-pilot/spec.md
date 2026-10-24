# Spec Delta

## Purpose

Verify the classroom API workload and external UI integration contract with explicit session availability responses and durable saved data.

## ADDED Requirements

### Requirement: Classroom API workload
The deployed API SHALL support an authenticated owner creating and hosting a mixed quiz with thirty guest sessions, accepting answers, finalizing, and retrieving results through its documented HTTP and live-event interfaces. The tested concurrent-room envelope SHALL be documented before the pilot.

#### Scenario: Classroom API rehearsal
- **GIVEN** the API deployment is running within its documented tested envelope
- **WHEN** an authenticated owner and thirty guest test clients complete a mixed game
- **THEN** admission, answer acknowledgements, scores, finalization, and owned report retrieval match the documented contracts

#### Scenario: Concurrent room isolation
- **GIVEN** the documented envelope includes several simultaneous classrooms
- **WHEN** guest clients submit answers in different rooms
- **THEN** rosters, questions, accepted answers, and results do not cross rooms

### Requirement: External UI integration contract
The API SHALL document REST authentication, inputs, outputs, field errors, and status codes plus live-event requests, acknowledgements, broadcasts, session restoration, revisions, and deadline units. Deployed access SHALL support configured UI origins without requiring the UI to be hosted in this repository.

#### Scenario: Independent UI consumer
- **GIVEN** a client connects from a configured UI origin to the deployed API
- **WHEN** it authenticates, creates a room, and uses the documented live-session protocol
- **THEN** HTTP access and socket connection establishment work with the documented credentials and response shapes without an API-hosted browser application

#### Scenario: Unconfigured UI origin
- **GIVEN** a browser request supplies an origin outside the configured UI allowlist
- **WHEN** it requests cross-origin API access or establishes a live connection
- **THEN** the API does not grant cross-origin response access and rejects the live connection

### Requirement: Session unavailable responses
When a live room is absent after restart or expiry, the API SHALL reject restoration, synchronization, and new answers for that room with an explicit SESSION_UNAVAILABLE error. It SHALL NOT bind an old room credential to a different room that reuses its PIN. Saved quizzes and successfully stored reports SHALL remain accessible to their owners.

#### Scenario: Backend restart
- **GIVEN** live room state was lost during backend restart
- **WHEN** a client attempts restoration, synchronization, or answering using the old room identity
- **THEN** the API returns SESSION_UNAVAILABLE without accepting an answer or returning a playable stale snapshot

#### Scenario: Reused PIN
- **GIVEN** a closed room's PIN has been assigned to a new room
- **WHEN** a client restores the old room with its old credential
- **THEN** the API returns SESSION_UNAVAILABLE without admitting the client to the new room

#### Scenario: Stored data remains
- **GIVEN** quizzes and a completed report were stored before a restart
- **WHEN** the authenticated owner retrieves them through the API after restart
- **THEN** the saved quizzes and completed report remain available with their stored content
