# Tasks

Work one tested behavior at a time: failing test, minimal implementation, then refactor. Baseline tasks 1.1–1.3 are verified in issue #46's documentation PR. Feature tasks remain pending; publishing the plan does not implement quiz behavior.

## 1. Baseline and API integration contract

- [x] 1.1 Reconcile archived authentication requirements against current code/tests and establish accurate main auth specs; verify openspec list --specs and strict spec validation, documenting any discrepancy instead of silently changing auth.
- [x] 1.2 Record this repository's API-only boundary and REST contract examples for the separate UI; verify the artifact defines ownership, request/response shapes, validation errors, and status codes without frontend setup tasks.
- [x] 1.3 Verify existing API authentication/expiry behavior needed by authoring and document how clients supply account credentials; confirm valid credentials permit access and missing/expired credentials receive the existing 401 contract.

Evidence: [authentication baseline reconciliation](../../../docs/authentication-baseline.md), [current auth contract](../../../docs/contracts/authentication.md), [API/UI boundary](../../../docs/api-ui-boundary.md), and the authoring design's proposed HTTP contract. Unit, isolated-database integration/e2e, and normal-bootstrap checks passed without application changes. Only these prerequisite tasks are complete; the authoring change is not ready to archive.

## 2. Create and reopen a private draft

- [x] 2.1 Write one failing create-draft behavior test, then add only the required domain/use-case ports, Kysely migration/adapter, and authenticated endpoint; verify a dedicated-test-database create/read round trip and document the endpoint.
- [x] 2.2 Exercise create/list/read through HTTP integration tests and document examples; verify a newly created empty draft persists across requests and only the owner's summaries are returned.
- [x] 2.3 Add cross-owner and unauthenticated access scenarios one at a time; verify user/admin accounts cannot read foreign drafts and invalid credentials return 401.

Issue #47 evidence: [HTTP/PostgreSQL transport tests](../../../test/quiz.controller.spec.ts), [public contract and OpenAPI handoff](../../../docs/contracts/quiz-drafts.md), and [current architecture diagrams](../../../docs/architecture/quiz-drafts.md). The create, reopen, list, ownership-input, and titled-draft behaviors were exercised red-to-green. Dedicated PostgreSQL database `robinhoot_issue47_test` on loopback port 55447 was migrated independently of the application database. Tests include committed persistence through a second app/pool, user/admin foreign-read denial, missing/expired/invalid/revoked credentials, structural input rejection, and generated OpenAPI example parity. Full question readiness/edit/delete and the authoring stage's final review remain pending under tasks 3–4; this change is not ready to archive.

## 3. Edit, order, and validate questions

- [ ] 3.1 Test one draft-save behavior then implement atomic updates with stable question/option IDs; verify API save and subsequent read preserve text and choices.
- [ ] 3.2 Test and implement readiness errors for title, count, four multiple-choice options, one correct choice, and supported durations; verify incomplete drafts save but fail hostability with field errors.
- [ ] 3.3 Add and test question reordering through the API; verify a two-question quiz reopens in the chosen order and document the request/response examples.
- [ ] 3.4 Test malformed draft inputs and unauthorized mutations, then implement rejection; verify existing data remains unchanged on errors.

## 4. Delete and demonstrate the authoring slice

- [ ] 4.1 Test and implement owner-only deletion through the API; verify list removal, foreign-account denial, and persistence behavior without cascade assumptions for future snapshots.
- [ ] 4.2 Review domain dependency direction, Symbol DI bindings, and boundary validation; verify relevant tests, API build and scoped lint checks.
- [ ] 4.3 Demonstrate two-question authoring through HTTP with a second account unable to access it; record API acceptance evidence and deliver OpenAPI examples to the separate UI repository's maintainer.

## Workflow follow-up

- Published issue tracking: [#46](https://github.com/CusmaLinux/robinhoot/issues/46) — 1.1–1.3; [#47](https://github.com/CusmaLinux/robinhoot/issues/47) — 2.1–2.3; [#48](https://github.com/CusmaLinux/robinhoot/issues/48) — 3.1–3.4; [#49](https://github.com/CusmaLinux/robinhoot/issues/49) — 4.1–4.3. See [issue map](../../../docs/mvp-issue-map.md) for blockers and classification. Issue creation does not complete these tasks.

- Review the implemented diff and acceptance evidence before archiving this change.
- Archive after API implementation/verification and documented contract handoff, then confirm its requirements are present in main specs; UI completion is tracked separately.
- Reconcile the next change against the resulting main specs before applying it.

- Link related UI issues in the separate repository once their real URLs are known; screen implementation, browser accessibility, and joint professor rehearsal are external product follow-up.
