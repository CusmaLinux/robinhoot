# One live timed round

## Why

A working lobby does not prove the live API behavior. One reliable round demonstrates synchronized state, answer acceptance, reveal, and scoring across independent clients.

## What Changes

- Open the first question on host command, freeze the player roster, and broadcast safe timed state.
- Accept one answer per player/question, acknowledge retries, reject late/conflicting submissions, and score at reveal.
- Recover active-round state after brief disconnections and cancel when the host reconnect window expires.

## Capabilities

### New Capabilities

- `live-gameplay`: Host start, timed answer acceptance, reveal, scoring, and active reconnect.

### Modified Capabilities

None. These additions compose with predecessor capabilities; recheck the main specs after predecessor archival before applying this change.

## Impact

Depends on add-game-lobby being implemented and archived. Extends live game application use cases and gateway payload projections with clock/scheduler ports and API tests. Host/player screens and countdown rendering belong to the separate UI repository. No historical results or automatic progression.

Affected people: API maintainer(s), maintainers of the separate UI repository as contract consumers, pilot professors, and participating students. No separate organizational teams are assumed.

Repository boundary: this change owns API behavior, contract documentation, and API verification. Track screen/rendering/client-storage work separately in the UI repository. See [API/UI boundary](../../../../docs/api-ui-boundary.md). API archival depends on its API acceptance evidence and documented handoff, not UI implementation completion.

Existing patterns: follow AuthModule's application ports, Symbol DI bindings, boundary DTOs, and Kysely adapters. Retain the existing user/admin authentication model. See [MVP guide](../../../../docs/mvp-development-guide.md).

## Dependencies and Review Gates

Implement and archive add-game-lobby first. These prerequisites are documented review gates; artifact readiness does not enforce cross-change ordering.

All six roadmap changes are drafted together at the user's request. Later drafts must be reconciled with implemented predecessor behavior before application. Numeric defaults are planning decisions to review, not measured performance claims.

## Rollback Plan

Disable starting rounds, cancel active rounds with an explicit reason, and restore lobby-only behavior. Keep quizzes intact; no completed reports exist at this stage.
