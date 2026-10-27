# game-progression Specification

## Purpose
Let the professor control a complete ordered game and finish durably or cancel with an explicit outcome for participants.

## Requirements

### Requirement: Manual ordered progression
Only the authenticated owner SHALL open the next snapshot question from reveal. Next SHALL be unavailable while a question is open or after the last question. A retried command SHALL NOT skip a question or reset an open question.

#### Scenario: Next question
- **GIVEN** question one is revealed and question two exists
- **WHEN** the owner advances
- **THEN** question two opens in snapshot order with its own full duration

#### Scenario: Retry or out-of-phase command
- **GIVEN** a next command already succeeded or a question is still open
- **WHEN** the command is retried or sent in the wrong phase
- **THEN** no question is skipped and no deadline is reset

### Requirement: Durable finalization
Only the authenticated owner SHALL finalize after the last question's reveal. Completion SHALL be announced only after the final report is stored. Repeated or concurrent finalization SHALL produce one stable report; a failed save SHALL remain retryable without changing scores.

#### Scenario: Save before finish
- **GIVEN** the last question is revealed
- **WHEN** the owner finalizes successfully
- **THEN** one stored report exists before the API broadcasts FINISHED

#### Scenario: Save failure and retry
- **GIVEN** the last question is revealed and report storage is unavailable
- **WHEN** the owner finalizes, then retries after storage recovers
- **THEN** the first attempt returns a retryable error without broadcasting FINISHED and the retry produces one report

#### Scenario: Lost final acknowledgement
- **GIVEN** a report was stored but the completion acknowledgement was lost
- **WHEN** the owner repeats finalization
- **THEN** the same report is returned without another report being created

### Requirement: Explicit game cancellation
The owner SHALL be able to cancel an active room. Cancellation SHALL stop further answer acceptance and progression, notify participants with a reason, and SHALL NOT create a completed report.

#### Scenario: End early
- **GIVEN** a game has unanswered or remaining questions
- **WHEN** the owner ends the game early
- **THEN** connected participants receive cancellation with a reason and no completed report is created

#### Scenario: Unauthorized cancellation
- **GIVEN** a guest or other account is present
- **WHEN** it requests cancellation
- **THEN** the request is rejected and the game continues
