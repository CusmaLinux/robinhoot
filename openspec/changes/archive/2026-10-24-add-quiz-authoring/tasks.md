# Tasks

Work one tested behavior at a time: failing test, minimal implementation, then refactor. Baseline tasks 1.1–1.3 were verified in issue #46's documentation PR; feature tasks were verified through issues #47–#49 as recorded below.

## 1. Baseline and API integration contract

- [x] 1.1 Reconcile archived authentication requirements against current code/tests and establish accurate main auth specs; verify openspec list --specs and strict spec validation, documenting any discrepancy instead of silently changing auth.
- [x] 1.2 Record this repository's API-only boundary and REST contract examples for the separate UI; verify the artifact defines ownership, request/response shapes, validation errors, and status codes without frontend setup tasks.
- [x] 1.3 Verify existing API authentication/expiry behavior needed by authoring and document how clients supply account credentials; confirm valid credentials permit access and missing/expired credentials receive the existing 401 contract.

Evidence: [authentication baseline reconciliation](../../../../docs/authentication-baseline.md), [current auth contract](../../../../docs/contracts/authentication.md), [API/UI boundary](../../../../docs/api-ui-boundary.md), and the authoring design's proposed HTTP contract. Unit, isolated-database integration/e2e, and normal-bootstrap checks passed without application changes. Only these prerequisite tasks are complete; the authoring change is not ready to archive.

## 2. Create and reopen a private draft

- [x] 2.1 Write one failing create-draft behavior test, then add only the required domain/use-case ports, Kysely migration/adapter, and authenticated endpoint; verify a dedicated-test-database create/read round trip and document the endpoint.
- [x] 2.2 Exercise create/list/read through HTTP integration tests and document examples; verify a newly created empty draft persists across requests and only the owner's summaries are returned.
- [x] 2.3 Add cross-owner and unauthenticated access scenarios one at a time; verify user/admin accounts cannot read foreign drafts and invalid credentials return 401.

Issue #47 evidence: [HTTP/PostgreSQL transport tests](../../../../test/quiz.controller.spec.ts), [public contract and OpenAPI handoff](../../../../docs/contracts/quiz-drafts.md), and [current architecture diagrams](../../../../docs/architecture/quiz-drafts.md). The create, reopen, list, ownership-input, and titled-draft behaviors were exercised red-to-green. Dedicated PostgreSQL database `robinhoot_issue47_test` on loopback port 55447 was migrated independently of the application database. Tests include committed persistence through a second app/pool, user/admin foreign-read denial, missing/expired/invalid/revoked credentials, structural input rejection, and generated OpenAPI example parity. Full question readiness/edit/delete and the authoring stage's final review remain pending under tasks 3–4; this change is not ready to archive.

## 3. Edit, order, and validate questions

- [x] 3.1 Test one draft-save behavior then implement atomic updates with stable question/option IDs; verify API save and subsequent read preserve text and choices.
- [x] 3.2 Test and implement readiness errors for title, count, four multiple-choice options, one correct choice, and supported durations; verify incomplete drafts save but fail hostability with field errors.
- [x] 3.3 Add and test question reordering through the API; verify a two-question quiz reopens in the chosen order and document the request/response examples.
- [x] 3.4 Test malformed draft inputs and unauthorized mutations, then implement rejection; verify existing data remains unchanged on errors.

Issue #48 evidence: the [HTTP/PostgreSQL suite](../../../../test/quiz.controller.spec.ts) verifies atomic full saves, stable IDs, question/option ordering, field-specific incomplete readiness, structural bounds, duplicate/dangling ID rejection, owner/admin denial, invalid credentials, unchanged content/timestamps on rejection, generated OpenAPI request/response parity, and committed edits reopened through an independent app/pool. The [pure domain suite](../../../../src/quiz/domain/quiz.spec.ts) checks readiness and numeric boundaries. Save/retrieve, incomplete readiness, duplicate question/option identities, dangling references, repeated correct IDs, and nested-array rejection were exercised red-to-green. Reordering was verified through the aggregate save path. See the [contract handoff](../../../../docs/contracts/quiz-drafts.md) and [updated component/sequence/state diagrams](../../../../docs/architecture/quiz-drafts.md).

Verification (2026-10-24): isolated PostgreSQL 17 database `robinhoot_issue48_test`, loopback port 55448, test-only credentials, and all four existing migrations. Unit: 71 tests / 15 suites. Integration: 92 tests / 3 suites, including 79 quiz HTTP tests. E2E: 4 tests. Build, TypeScript, strict change validation, and whitespace checks pass. Read-only ESLint has zero errors and only the two pre-existing auth guard test warnings; changed code has no warnings. Advisory Fallow audit passes with no introduced findings. No new schema migration or production database change. Existing six main authentication specs and #47 implementation were reviewed before this slice. Tasks 4.1–4.3, final review, and full-change archival remain pending for #49.

## 4. Delete and demonstrate the authoring slice

- [x] 4.1 Test and implement owner-only deletion through the API; verify list removal, foreign-account denial, and persistence behavior without cascade assumptions for future snapshots.
- [x] 4.2 Review domain dependency direction, Symbol DI bindings, and boundary validation; verify relevant tests, API build and scoped lint checks.
- [x] 4.3 Demonstrate two-question authoring through HTTP with a second account unable to access it; record API acceptance evidence and deliver OpenAPI examples to the separate UI repository's maintainer.

Issue #49 evidence (2026-10-24): owner deletion was exercised red-to-green through HTTP/PostgreSQL. The deletion OpenAPI parity check also failed before documentation was added and then passed. The [quiz transport suite](../../../../test/quiz.controller.spec.ts) verifies owner-list/read removal, retained other drafts, user/admin denial without content/timestamp changes, identical missing/repeated/foreign 404s, malformed UUID rejection, missing/invalid/expired/revoked credential rejection, empty 204 responses, and committed deletion observed through an independent app/pool. The two-question create/edit/reorder/reopen/delete walkthrough checks second-account list/read/write/delete isolation. The [contract](../../../../docs/contracts/quiz-drafts.md), [walkthrough](../../../../docs/contracts/quiz-authoring-walkthrough.md), generated OpenAPI examples, and [architecture/state/sequence diagrams](../../../../docs/architecture/quiz-drafts.md) provide the documented UI handoff; no external maintainer message or UI implementation is claimed.

Verification: isolated PostgreSQL 17 container `robinhoot-issue49-test`, database `robinhoot_issue49_test`, loopback port 55449, test-only credentials, and all four existing migrations. Unit: 71 tests / 15 suites. Integration: 104 tests / 3 suites, including 91 quiz HTTP tests. E2E: 4 tests. Build, TypeScript, scoped ESLint, strict OpenSpec validation, and whitespace checks pass. Full read-only ESLint has no errors and only the two pre-existing auth guard test warnings; advisory Fallow audit passes with no introduced findings. The final diff review confirmed dependency direction, existing Symbol bindings, UUID/auth boundaries, and the single owner-scoped DELETE. No migration, cascade, game/report dependency, or production database change was introduced. The six main auth specs, merged #48 behavior, and planned room/report snapshot boundaries were reread. Concrete snapshot-retention regressions remain required when those modules exist; no nonexistent game/report storage was invented for this slice. All 13 authoring tasks are complete and the full API change is ready for archival after this review.

## Workflow follow-up

- Published issue tracking: [#46](https://github.com/CusmaLinux/robinhoot/issues/46) — 1.1–1.3; [#47](https://github.com/CusmaLinux/robinhoot/issues/47) — 2.1–2.3; [#48](https://github.com/CusmaLinux/robinhoot/issues/48) — 3.1–3.4; [#49](https://github.com/CusmaLinux/robinhoot/issues/49) — 4.1–4.3. See [issue map](../../../../docs/mvp-issue-map.md) for blockers and classification. Issue creation does not complete these tasks.

- Review the implemented diff and acceptance evidence before archiving this change.
- Archive after API implementation/verification and documented contract handoff, then confirm its requirements are present in main specs; UI completion is tracked separately.
- Reconcile the next change against the resulting main specs before applying it.

- Link related UI issues in the separate repository once their real URLs are known; screen implementation, browser accessibility, and joint professor rehearsal are external product follow-up.
