# Robinhoot API documentation

This repository implements the API. The existing UI is maintained separately; see [API/UI ownership](api-ui-boundary.md) for integration and completion responsibilities.

## Implemented behavior

- [Durable game finalization](contracts/game-finalization.md): owner-only finish, saved immutable report facts, shared ranks, retryable failures and completion after persistence.

- [Question progression and early cancellation](contracts/game-progression.md): ordered owner-only next, retained retries and cumulative scores, terminal cancellation, and multi-question examples.

- [Timed first question](contracts/live-question.md): owner-only start, fixed eligibility, safe labeled options, authoritative deadline, and automatic no-answer reveal.
- [Live-question architecture](architecture/live-question.md): ports, timing, start/retry sequence, and phase transitions.

- [Lobby closure and host return](contracts/lobby-lifecycle.md): owner cancellation, thirty-minute expiry, 120-second host return, replacement authority, closure reasons, and cleanup.
- [Guest restoration](contracts/lobby-restoration.md): room-scoped reconnect credentials and consistent subscribed snapshots.

- [Guest admission and roster contract](contracts/lobby-admission.md): Socket.IO host authentication, private guest sessions, safe rosters, limits, retries, and errors.
- [Lobby admission architecture](architecture/lobby-admission.md): transport authorization, atomic membership, session boundaries, and admission sequence/state.

- [Owned room creation contract](contracts/room-creation.md): safe metadata, immutable snapshots, host identity, unique PINs, retries, and errors.
- [Room creation architecture](architecture/room-creation.md): ports, owner serialization, creation/retry sequence, and current state transitions.

- [Private quiz draft API contract](contracts/quiz-drafts.md): authenticated create/list/read/save/delete, question ordering, stable IDs, ownership, readiness errors, and test database instructions.
- [Two-account authoring walkthrough](contracts/quiz-authoring-walkthrough.md): two-question creation, editing, reordering, access denial, and deletion for API/UI handoff.
- [Quiz draft architecture](architecture/quiz-drafts.md): verified components, request sequence, and draft state.
- [Authentication API contract](contracts/authentication.md): current requests, responses, validation, expiry, revocation, and role semantics.
- [Authentication baseline reconciliation](authentication-baseline.md): source/test evidence, differences from archived notes, and verification limits.
- [Main behavioral specifications](../openspec/specs/): current authentication, private quiz authoring, and lobby capabilities.

## MVP planning and delivery

- [MVP development guide](mvp-development-guide.md): proposed API scope, game rules, ordered changes, and review workflow.
- [Published issue map](mvp-issue-map.md): links from the API epic and implementation issues to OpenSpec changes/tasks.
- [Active change proposals](../openspec/changes/): future behavior, design, and tracked work. Their presence does not imply the capabilities are implemented.

## Use cases and diagrams

Use professor and guest goals to connect issues to observable API behavior. Add proposed Mermaid domain, sequence, component, and state diagrams to a change's design when they help explain a decision. Show the separately maintained UI as an external consumer.

As implementation lands, maintain verified current architecture in `docs/architecture/`; create those documents when useful rather than scaffolding empty diagrams. Archived change designs remain historical context. Keep behavioral requirements in OpenSpec and avoid duplicating them in a second specification tree.
