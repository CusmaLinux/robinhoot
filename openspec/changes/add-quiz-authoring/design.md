# Design

## Context

See proposal.md for motivation and specs/quiz-authoring/spec.md for behavior. The repository contains a NestJS backend with an auth module and Kysely database provider. Issue #46 reconstructs six current main auth specs; see [baseline evidence](../../../docs/authentication-baseline.md) for reconciled differences and verification limits. Quiz endpoints remain unimplemented.

## Goals / Non-Goals

Repository boundary: this is an API-only change. The existing UI is an external consumer maintained in another repository. See [API/UI boundary](../../../docs/api-ui-boundary.md) for contract handoff and completion responsibilities.

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
