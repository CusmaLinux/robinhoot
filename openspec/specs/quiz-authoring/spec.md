# quiz-authoring Specification

## Purpose
Allow professors to prepare and maintain private reusable quizzes while distinguishing incomplete drafts from quizzes ready for classroom hosting.

## Requirements

### Requirement: Private quiz ownership
The system SHALL let authenticated users create, list, read, update, reorder, and delete their own quizzes. It SHALL reject unauthenticated access and SHALL NOT grant cross-owner access solely because an account is an admin.

#### Scenario: Save and reopen
- **GIVEN** an authenticated professor owns a quiz
- **WHEN** the professor saves its title and ordered questions through the API and retrieves the quiz
- **THEN** the API returns the saved content and order

#### Scenario: Cross-owner access
- **GIVEN** a quiz belongs to another account
- **WHEN** a user or admin attempts to read, update, reorder, or delete it
- **THEN** the request is denied without changing or exposing the quiz

#### Scenario: List isolation
- **GIVEN** two professors own different quizzes
- **WHEN** one lists their quizzes
- **THEN** only that professor's quizzes are returned

#### Scenario: Unauthenticated request
- **GIVEN** a visitor has no valid account credential
- **WHEN** the visitor requests the private quiz API
- **THEN** the request is rejected as unauthenticated

### Requirement: Incomplete drafts
The system SHALL save incomplete quiz drafts and report whether a draft is hostable with field-specific validation errors. Saving a draft SHALL NOT bypass ownership or structural input validation.

#### Scenario: Empty draft
- **GIVEN** a professor has a new quiz
- **WHEN** the professor saves an empty draft
- **THEN** the draft is retained and marked not hostable with missing-field errors

#### Scenario: Invalid structure
- **GIVEN** an owned draft exists
- **WHEN** the client submits a malformed question collection to the API
- **THEN** the request is rejected and the saved draft remains unchanged

### Requirement: Hostable multiple-choice quiz
A hostable quiz SHALL have a nonempty title and 1–20 ordered questions. Each multiple-choice question SHALL have a nonempty prompt, exactly four nonempty options, exactly one correct option, and a duration of 10, 20, 30, or 60 seconds.

#### Scenario: Valid quiz
- **GIVEN** a draft contains two complete multiple-choice questions with supported durations
- **WHEN** the professor checks readiness
- **THEN** the quiz is reported hostable

#### Scenario: Invalid question
- **GIVEN** a draft has no correct option, several correct options, a blank option, or an unsupported duration
- **WHEN** the professor checks readiness
- **THEN** the quiz is not hostable and the affected fields are identified

#### Scenario: Question count
- **GIVEN** a draft contains zero or more than twenty questions
- **WHEN** the professor checks readiness
- **THEN** the quiz is not hostable

### Requirement: Stable question order and deletion
The system SHALL persist the owner's explicit question ordering. Deleting a saved quiz SHALL remove it from its owner's list without changing previously created live-game snapshots or completed reports.

#### Scenario: Reorder questions
- **GIVEN** an owned quiz has questions A and B
- **WHEN** the professor saves B before A and retrieves the quiz through the API
- **THEN** the order is B then A

#### Scenario: Delete source quiz
- **GIVEN** a quiz has an independent game snapshot or completed report
- **WHEN** its owner deletes the saved quiz
- **THEN** the saved quiz disappears while those snapshots and reports remain unchanged
