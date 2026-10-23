# True/False and question images

## Why

The pilot needs more than text multiple-choice questions. True/False and optional images support common teaching material without requiring a media storage subsystem.

## What Changes

- Add True/False questions with two fixed choices and one correct answer.
- Accept validated optional HTTPS image references without fetching or serving remote image bytes.
- Carry question type, image references, and fixed choice identities through authoring endpoints, snapshots, gameplay events, and report responses.

## Capabilities

### New Capabilities

- `quiz-question-formats`: True/False semantics and optional question images across the quiz lifecycle.

### Modified Capabilities

None. These additions compose with predecessor capabilities; recheck the main specs after predecessor archival before applying this change.

## Impact

Depends on finish-game-with-results being implemented and archived. Extends quiz DTO/storage/snapshot formats and documented API payloads. The separate UI repository owns type controls, image rendering/fallback, and answer buttons. Multiple-choice validation continues to apply to multiple-choice questions; no uploads or backend URL fetching.

Affected people: API maintainer(s), maintainers of the separate UI repository as contract consumers, pilot professors, and participating students. No separate organizational teams are assumed.

Repository boundary: this change owns API behavior, contract documentation, and API verification. Track screen/rendering/client-storage work separately in the UI repository. See [API/UI boundary](../../../docs/api-ui-boundary.md). API archival depends on its API acceptance evidence and documented handoff, not UI implementation completion.

Existing patterns: follow AuthModule's application ports, Symbol DI bindings, boundary DTOs, and Kysely adapters. Retain the existing user/admin authentication model. See [MVP guide](../../../docs/mvp-development-guide.md).

## Dependencies and Review Gates

Implement and archive finish-game-with-results first. These prerequisites are documented review gates; artifact readiness does not enforce cross-change ordering.

All six roadmap changes are drafted together at the user's request. Later drafts must be reconciled with implemented predecessor behavior before application. Numeric defaults are planning decisions to review, not measured performance claims.

## Rollback Plan

Disable creation of new extended questions first. Keep readers that understand already-saved mixed quizzes/reports until data is explicitly migrated or backed up; do not run an older reader against incompatible data.
