# Design

## Context

See proposal.md for motivation and specs/quiz-authoring/spec.md for behavior. The repository contains a NestJS backend with an auth module and Kysely database provider. Issue #46 reconstructs six current main auth specs; see [baseline evidence](../../../../docs/authentication-baseline.md) for reconciled differences and verification limits. Issue #47 implements private draft create/list/read; issue #48 adds editing, ordering, and full multiple-choice readiness. Deletion and final stage acceptance remain pending in #49.

## Implemented draft slice (issue #47)

The [current API contract](../../../../docs/contracts/quiz-drafts.md) and [architecture/state/sequence diagrams](../../../../docs/architecture/quiz-drafts.md) document the create/list/read behavior. POST accepts an optional title (string, at most 200 characters), creates an empty question collection, and returns persisted content plus readiness errors. Creation does not accept questions or caller-selected ownership; question input/save belongs to issue #48. Lists return owned summaries ordered newest first, then UUID descending. Read/list use owner predicates in the database query; foreign and missing resources return identical 404s.

The reconciled six main authentication specs and predecessor #46 were rechecked before implementation; existing authentication behavior is reused. Test evidence is maintained with tasks 2.1–2.3. This partial slice does not archive the full authoring change or mark later tasks complete.

## Implemented editing slice (issue #48)

PUT replaces the full `{ title, questions }` aggregate in a single owner-scoped `UPDATE ... RETURNING` over the existing JSONB row; no migration is needed. The database supplies the update timestamp. Arrays define question/option order. Clients generate required UUIDs once and retain them on edit/reorder; identity scope is quiz/question, with case-insensitive uniqueness and reference checks. Correctness is an array of option UUIDs so incomplete drafts can contain zero or multiple distinct selections, while hostability requires exactly one.

Boundary DTOs require the complete nested shape, reject unknown fields and nested arrays masquerading as objects, and cap title/prompt/option text at 200/2000/1000 characters, questions at twenty and options/correct IDs at four. A duration is null or an integer from 0–3600 structurally, with 10/20/30/60 required for readiness. Domain checks reject duplicate IDs and dangling correct references before the repository writes. Domain readiness reports field paths using saved zero-based array positions. GET and list derive readiness from saved content. Concurrent full saves are last-write-wins; revision detection is outside this slice.

See the [contract](../../../../docs/contracts/quiz-drafts.md) for complete examples and structural/readiness distinctions, and the [diagrams](../../../../docs/architecture/quiz-drafts.md) for save sequences and state transitions. Existing main authentication specs and #47 implementation were reread before applying this slice. The full authoring change remains active until #49 verifies deletion and final handoff; it is not archived at this partial boundary.

## Implemented deletion and final acceptance (issue #49)

DELETE returns 204 with an empty body after a single SQL delete constrained by verified owner ID and quiz UUID. Missing, repeated, and foreign IDs share the existing 404 contract; admins have no bypass. The inbound controller validates UUIDs and maps the boolean use-case result to HTTP, the application delegates through the repository Symbol port, and the Kysely adapter interprets the affected row count. Existing DI bindings and domain dependencies remain unchanged. No migration or cascading dependency is introduced.

The HTTP suite verifies removal from later reads/listing, retained other drafts, foreign user/admin denial without mutation, authentication/UUID errors, committed deletion seen by a second app/pool, OpenAPI parity, and a complete two-question authoring/edit/reorder/delete flow with a second account denied access. See the [walkthrough](../../../../docs/contracts/quiz-authoring-walkthrough.md) and task evidence for the documented UI contract handoff and verification results. No Socket.IO contract is needed for private authoring.

Room/report storage is not implemented yet. Reviewed successor designs require independently owned snapshots, deep-copy on room creation, and no source-quiz cascading foreign key into reports. Concrete retention tests must land with those features; this stage verifies that quiz deletion introduces no dependency that could cascade into them. The six reconciled main auth specs and merged #48 behavior were reread before this final slice. All API authoring tasks are verified; archive the full change and promote its requirements to main specs at this stage boundary.

## Goals / Non-Goals

Repository boundary: this is an API-only change. The existing UI is an external consumer maintained in another repository. See [API/UI boundary](../../../../docs/api-ui-boundary.md) for contract handoff and completion responsibilities.

Goals: deliver private REST authoring and persistence with a documented contract the existing UI can consume.
Non-goals: frontend packages/screens, live rooms, media, student accounts, a public quiz catalogue, or refactoring auth unrelated to the feature.

## Decisions

1. Add a quiz capability using the existing domain/application/infrastructure layout. Application services depend on quiz repository and identity inputs through ports with Symbol DI bindings. Keep Nest DTO validation in inbound adapters, draft/hostability invariants in the application/domain, and Kysely in outbound adapters. This follows AuthModule rather than introducing a new architectural pattern.
2. Store one quiz row with UUID, owner ID, title, ordered question JSONB, and timestamps. Questions/options carry stable IDs. Save the aggregate atomically so reordering cannot leave partial rows. JSONB is sufficient for small bounded quizzes; relational question tables are an alternative if later query/report needs justify them. Completed games will own independent snapshots rather than foreign keys that cascade into historical content.
3. Define a discriminated question format with type multiple-choice at this stage. Allow blank fields in structurally valid drafts, but expose hostable plus field errors derived from shared validation rules. Enforce safe structural bounds on draft input and the twenty-question limit before storage. Multiple-choice hostability requires exactly four valid choices and one correct choice. Do not label all future question formats invalid by permanent contract.
4. Proposed HTTP contract: POST/GET /quizzes, GET/PUT/DELETE /quizzes/:id. List returns only owned quiz summaries; read and save include readiness/errors. Use 401 for missing/invalid account identity, 404 for absent or foreign resources, and 400 for malformed input. Derive ownership from validated identity, never a submitted owner ID.
5. Reuse existing account authentication and document authorization headers, expiry behavior, and 401/404 errors for the separate UI. Token storage, login screens, reauthentication interaction, client routing, and frontend tooling belong to that repository. Do not add a browser package here or choose a UI framework.
6. Deliver Swagger/OpenAPI operations and examples for draft CRUD, readiness errors, stable IDs, ordering, and deletion. API integration tests exercise the same HTTP contract a client consumes, including malformed inputs and ownership failures. Document validated origin configuration during deployment rather than assuming a same-origin UI. Do not generate empty infrastructure layers before each tested behavior needs them.

## Risks / Trade-offs

- Auth baseline drift → use the reconciled main specs and baseline evidence, recheck relevant guards/token validation before adding quiz behavior, and do not change authentication opportunistically.
- JSONB allows malformed data if bypassing application services → validate at inbound boundaries and before repository writes; integration-test aggregate round trips.
- Separate UI can drift from the contract → provide request/response/error examples and coordinate incompatible contract changes with its maintainer.
- Account credentials can expire during integration → verify existing API expiry responses and document them without prescribing client storage.

## Migration Plan

Merge issue #46's reconciled baseline first, then implement one API behavior at a time with a failing test and minimal change. Add the quiz migration, use cases, endpoints, and contract documentation in vertical slices. Use a dedicated test database for persistence checks. Deploy migration before enabling quiz routes and communicate availability to the UI maintainer. Rollback disables routes and retains data; do not drop saved quizzes without an explicit data plan.

## UI Integration Follow-up

The separate UI repository implements quiz editing and validation presentation using these endpoints. UI completion is part of the joint product milestone, not this API change's tracked implementation work.
