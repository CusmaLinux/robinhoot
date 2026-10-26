# Live room lobby

## Why

A professor and guests need a reliable way to gather before a game. The lobby establishes room ownership and guest identity without requiring student accounts.

## What Changes

- Create an owned room from a validated immutable quiz snapshot and issue a unique active six-digit PIN.
- Add guest join, roster updates, room-scoped reconnect credentials, limits, expiry, and host cancellation.
- Add explicit socket authentication/authorization, bounded join attempts, and documented host/player lobby payloads for the separate UI repository.

## Capabilities

### New Capabilities

- `game-lobby`: Room creation, snapshots, PIN admission, roster, and lobby reconnect.

### Modified Capabilities

None. These additions compose with predecessor capabilities; recheck the main specs after predecessor archival before applying this change.

## Impact

Depends on add-quiz-authoring being implemented and archived. Adds Socket.IO/Nest gateway dependencies, in-memory live storage, REST room creation, socket contracts, and API transport tests. The UI repository owns lobby screens and client session storage. No student database accounts.

Affected people: API maintainer(s), maintainers of the separate UI repository as contract consumers, pilot professors, and participating students. No separate organizational teams are assumed.

Repository boundary: this change owns API behavior, contract documentation, and API verification. Track screen/rendering/client-storage work separately in the UI repository. See [API/UI boundary](../../../../docs/api-ui-boundary.md). API archival depends on its API acceptance evidence and documented handoff, not UI implementation completion.

Existing patterns: follow AuthModule's application ports, Symbol DI bindings, boundary DTOs, and Kysely adapters. Retain the existing user/admin authentication model. See [MVP guide](../../../../docs/mvp-development-guide.md).

## Dependencies and Review Gates

Implement and archive add-quiz-authoring first. These prerequisites are documented review gates; artifact readiness does not enforce cross-change ordering.

All six roadmap changes are drafted together at the user's request. Later drafts must be reconciled with implemented predecessor behavior before application. Numeric defaults are planning decisions to review, not measured performance claims.

## Rollback Plan

Stop new room creation, notify/cancel existing lobbies through API events, then disable gateway bindings and communicate contract availability to the UI maintainer. Quizzes and authentication remain usable.
