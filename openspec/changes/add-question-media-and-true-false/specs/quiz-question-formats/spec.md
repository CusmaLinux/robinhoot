# Spec Delta

## Purpose

Expose validated classroom question formats and optional image metadata consistently through authoring, live-game, and saved-report API contracts.

## ADDED Requirements

### Requirement: True or False questions
The API SHALL support True/False questions with a nonempty prompt, two fixed choices named True and False, exactly one correct choice, and the supported question durations. Drafts with invalid True/False content SHALL NOT be hostable.

#### Scenario: Valid True or False
- **GIVEN** a professor adds a True/False question
- **WHEN** the professor sets one correct choice and a supported duration
- **THEN** the saved question is hostable and the API exposes exactly two fixed labeled choices during play

#### Scenario: Invalid truth question
- **GIVEN** a draft True/False question has zero or two correct choices
- **WHEN** the professor checks readiness
- **THEN** the invalid fields are identified and the quiz cannot be hosted

### Requirement: Optional question images
The API SHALL accept and return an optional HTTPS question image reference in authoring, safe live-question payloads, and reports. It SHALL NOT fetch the remote image or require its availability to open a question or accept an answer. Malformed, non-HTTPS, or credential-bearing references SHALL be rejected with a field error.

#### Scenario: Image metadata returned
- **GIVEN** a question has a valid HTTPS image reference
- **WHEN** an authorized consumer retrieves the question or its completed report through the API
- **THEN** the response contains the stored image reference alongside its question data

#### Scenario: Image unavailable
- **GIVEN** a saved image reference is unreachable
- **WHEN** the question is opened
- **THEN** the API opens the question without fetching the image and accepts otherwise valid answers according to the normal deadline

#### Scenario: Invalid reference
- **GIVEN** a professor enters a non-HTTPS or malformed image reference
- **WHEN** the professor submits the image field to the API
- **THEN** the reference is rejected with a field error

### Requirement: Mixed quiz compatibility
The API SHALL preserve question type, choice identity, and image reference through saving, game snapshots, and completed reports. Multiple-choice question payloads SHALL have four options; True/False SHALL have two. Both SHALL follow the same deadline, reveal, scoring, and ownership rules.

#### Scenario: Mixed game
- **GIVEN** a quiz contains multiple-choice and True/False questions with an optional image
- **WHEN** the owner hosts and completes it
- **THEN** each question payload contains its correct option count and the report retains its type, choices, and image reference

#### Scenario: Source edit after hosting
- **GIVEN** a mixed quiz has been snapshotted into a game
- **WHEN** the author later changes its type, choices, or image reference
- **THEN** the existing game and its completed report retain the original snapshot

#### Scenario: Existing quiz
- **GIVEN** a quiz was saved before question images and True/False were added
- **WHEN** the owner opens and hosts it
- **THEN** its multiple-choice content still validates and its live payload includes four options
