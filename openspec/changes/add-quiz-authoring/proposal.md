# Private quiz authoring

## Why

Professors need reusable quizzes before they can host a classroom game. Private authoring endpoints let the existing UI prepare those quizzes through this API.

## What Changes

- Add authenticated REST operations for private quiz listing, creation, editing, reordering, deletion, and retrieval.
- Support incomplete drafts and hostable validation for 1–20 text multiple-choice questions, four options, one correct option, and supported durations.
- Reuse account authentication and enforce resource ownership without adding account roles.

## Capabilities

### New Capabilities

- `quiz-authoring`: Private quiz CRUD, draft validation, ordering, and ownership.

### Modified Capabilities

None. These additions compose with predecessor capabilities; recheck the main specs after predecessor archival before applying this change.

## Impact

Quiz module, Kysely migrations/database types, authenticated REST endpoints, OpenAPI documentation, and API tests. The existing UI lives in a separate repository and consumes the contract; this change does not select its framework or add a frontend package here.

Affected people: API maintainer(s), maintainers of the separate UI repository as contract consumers, pilot professors, and participating students. No separate organizational teams are assumed.

Repository boundary: this change owns API behavior, contract documentation, and API verification. Track screen/rendering/client-storage work separately in the UI repository. See [API/UI boundary](../../../docs/api-ui-boundary.md). API archival depends on its API acceptance evidence and documented handoff, not UI implementation completion.

Existing patterns: follow AuthModule's application ports, Symbol DI bindings, boundary DTOs, and Kysely adapters. Retain the existing user/admin authentication model. See [MVP guide](../../../docs/mvp-development-guide.md).

## Dependencies and Review Gates

No MVP feature prerequisite. Merge issue #46's documentation PR, including the reconciled main authentication specs, before feature implementation. That baseline publication is separate from the new quiz requirements and does not implement quiz endpoints.

All six roadmap changes are drafted together at the user's request. Later drafts must be reconciled with implemented predecessor behavior before application. Numeric defaults are planning decisions to review, not measured performance claims.

## Rollback Plan

Disable quiz routes and coordinate contract availability with the UI maintainer; retain saved data while reverting application bindings. Only reverse additive migrations after backup and confirmation that no dependent game/report data requires them.
