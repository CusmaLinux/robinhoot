# game-results Specification

## Purpose
Expose final standings and question difficulty data through live API payloads and durable owned report endpoints after the game ends.

## Requirements

### Requirement: Final ranking
The API SHALL return final scores to the host and connected game participants after successful finalization. Players with equal totals SHALL share rank using competition ranking; nickname order SHALL stabilize response ordering without breaking ties.

#### Scenario: Tied totals
- **GIVEN** three players finish with totals 2000, 2000, and 1000
- **WHEN** the API returns the final ranking
- **THEN** their ranks are 1, 1, and 3, with stable nickname ordering for the tied players

### Requirement: Question difficulty
The system SHALL report each snapshot question's eligible, correct, incorrect, and missing-answer counts. Eligibility SHALL include every player present at game start, including disconnected players. Accuracy SHALL be correct divided by eligible players, and the lowest accuracy SHALL identify the hardest questions.

#### Scenario: Timeouts count
- **GIVEN** four eligible players have one correct, one incorrect, and two missing answers
- **WHEN** the owner retrieves the difficulty report from the API
- **THEN** accuracy is 25 percent and the counts are 4 eligible, 1 correct, 1 incorrect, and 2 missing

#### Scenario: Question difficulty order
- **GIVEN** one question has 25 percent accuracy and another has 75 percent
- **WHEN** the owner retrieves question difficulty data from the API
- **THEN** the response includes both accuracies and missing-answer counts and identifies the 25 percent question as harder

### Requirement: Owned durable reports
The system SHALL let only the owning professor list and reopen completed reports using account authentication. Stored question content, player scores, and counts SHALL remain stable after source quiz editing/deletion or backend restart. Guest room credentials SHALL NOT grant access to historical report endpoints.

#### Scenario: Restart and source deletion
- **GIVEN** a completed report has been stored
- **WHEN** the source quiz is deleted and the backend restarts
- **THEN** the owner can reopen the report with the original question snapshots, standings, and counts

#### Scenario: Foreign report
- **GIVEN** a report belongs to another professor
- **WHEN** another user or admin requests it or a guest uses a room credential on its historical endpoint
- **THEN** access is denied without exposing report content
