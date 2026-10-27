# live-gameplay Specification

## Purpose
Run a fair synchronized classroom question with authoritative timing, private submissions, deterministic scoring, and recoverable participant views.

## Requirements

### Requirement: Host-controlled round opening
Only the authenticated room owner SHALL start the first question from the lobby, with at least one joined player. Opening SHALL freeze eligible players and reject new admissions. Repeated start requests SHALL NOT open additional rounds or reset the deadline.

#### Scenario: Start first question
- **GIVEN** a lobby contains a host and two guests
- **WHEN** the owner starts
- **THEN** the first snapshot question opens for the two guests with one shared deadline

#### Scenario: Unauthorized or invalid start
- **GIVEN** the sender is not the owner, the lobby is empty, or the round is already open
- **WHEN** a start command is sent
- **THEN** an invalid command is rejected or its accepted retry is acknowledged without changing round state

#### Scenario: Late guest
- **GIVEN** the first question has opened
- **WHEN** a new guest attempts to join
- **THEN** admission is rejected while existing players can still reconnect

### Requirement: Authoritative answer deadline
The system SHALL supply server timing information and a question deadline. It SHALL accept new submissions only for the current open question when received strictly before that deadline, regardless of a client's clock or a delayed close notification.

#### Scenario: Exact cutoff
- **GIVEN** a question closes at server time T
- **WHEN** an answer is received at or after T
- **THEN** the answer is rejected as too late even if the close notification is delayed

#### Scenario: Wrong question or option
- **GIVEN** a player has a valid room session
- **WHEN** the player submits an option not in the current question or an answer for a different question
- **THEN** the answer is rejected without affecting scoring

### Requirement: One accepted answer
A guest SHALL submit answers only for their own room identity. The system SHALL accept at most one answer per player/question. A retry of an accepted submission SHALL return its original acknowledgement, including after closure; a conflicting second answer SHALL be rejected.

#### Scenario: Acknowledgement lost
- **GIVEN** an answer was accepted but its acknowledgement was lost
- **WHEN** the player resends the same submission after the question closes
- **THEN** the original acceptance is returned and no additional score is awarded

#### Scenario: Different second answer
- **GIVEN** a player already has an accepted answer
- **WHEN** the player submits a different answer or reuses its submission identifier with different content
- **THEN** the conflict is rejected and the original answer remains

#### Scenario: Forged identity
- **GIVEN** a player has only their own credential
- **WHEN** the player claims another identity in an answer message
- **THEN** the claim cannot change another player's accepted answer

### Requirement: Reveal and fixed scoring
The system SHALL close each question at its deadline and reveal its correct answer only after closure. Each correct accepted answer SHALL earn 1,000 points exactly once; incorrect or missing answers SHALL earn zero. Receiving all answers SHALL NOT shorten the timer.

#### Scenario: No early reveal
- **GIVEN** a question remains open and all guests have answered
- **WHEN** any participant receives public question or submission data
- **THEN** the payload reveals no correct-answer metadata and the deadline remains unchanged

#### Scenario: Score once
- **GIVEN** one player answered correctly and another did not answer
- **WHEN** the deadline closes and a close operation is retried
- **THEN** the first earns 1,000 points once, the second earns zero, and reveal shows the correct option

### Requirement: Active session synchronization
The API SHALL return a consistent role-safe snapshot with a returning player's identity, score, current phase, deadline, and accepted-answer state after valid session restoration. State updates SHALL identify the room, question when applicable, and monotonically increasing room revision.

#### Scenario: Return after reveal
- **GIVEN** a guest disconnected after submitting and the question has since closed
- **WHEN** the guest restores the session
- **THEN** the API returns reveal and their accepted result and rejects any new answer for that closed question

#### Scenario: Synchronize after missed updates
- **GIVEN** a room has progressed from one phase to a newer revision
- **WHEN** a client requests synchronization after missing state events
- **THEN** the API returns a consistent snapshot at the current room revision with current phase and accepted-answer state

### Requirement: Host absence during play
A disconnected host SHALL have 120 seconds to reauthenticate as the owner. The current question SHALL still close on time, progression SHALL wait for the host, and expiry of the reconnect window SHALL cancel the room with a reason.

#### Scenario: Timer continues
- **GIVEN** the host disconnects while a question is open
- **WHEN** the deadline passes before the host returns
- **THEN** the question closes normally and waits at reveal

#### Scenario: Host fails to return
- **GIVEN** an active game's host has been absent for 120 seconds
- **WHEN** the reconnect window expires
- **THEN** the game is cancelled and connected guests receive the cancellation reason
