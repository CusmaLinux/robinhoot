# Complete games and saved reports

## Why

Professors need to run all questions and understand learning difficulties afterward. Durable report endpoints preserve the facts the separate UI uses for standings and difficulty charts.

## What Changes

- Allow the host to advance from reveal to the next ordered question and finalize after the last reveal.
- Persist report snapshots and counts atomically and idempotently before announcing completion.
- Return shared-rank final standings and question accuracy/no-answer data; allow the owner to retrieve stored results after restart.

## Capabilities

### New Capabilities

- `game-progression`: Manual next-question transitions, cancellation, and finalization.
- `game-results`: Persistent final ranking, question difficulty, and owned report retrieval.

### Modified Capabilities

None. These additions compose with predecessor capabilities; recheck the main specs after predecessor archival before applying this change.

## Impact

Depends on play-live-question being implemented and archived. Adds result persistence/migrations, live progression commands, owned report REST endpoints, and verified ranking/difficulty payloads. Final screens, report history screens, and charts are implemented in the separate UI repository.

Affected people: API maintainer(s), maintainers of the separate UI repository as contract consumers, pilot professors, and participating students. No separate organizational teams are assumed.

Repository boundary: this change owns API behavior, contract documentation, and API verification. Track screen/rendering/client-storage work separately in the UI repository. See [API/UI boundary](../../../../docs/api-ui-boundary.md). API archival depends on its API acceptance evidence and documented handoff, not UI implementation completion.

Existing patterns: follow AuthModule's application ports, Symbol DI bindings, boundary DTOs, and Kysely adapters. Retain the existing user/admin authentication model. See [MVP guide](../../../../docs/mvp-development-guide.md).

## Dependencies and Review Gates

Implement and archive play-live-question first. These prerequisites are documented review gates; artifact readiness does not enforce cross-change ordering.

All six roadmap changes are drafted together at the user's request. Later drafts must be reconciled with implemented predecessor behavior before application. Numeric defaults are planning decisions to review, not measured performance claims.

## Rollback Plan

Disable advancing/finalizing and new report creation before rolling back live bindings. Keep stored reports and read compatibility or export/backup them; do not automatically drop result data.
