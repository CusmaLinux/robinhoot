# Tasks

Work one tested behavior at a time: failing test, minimal implementation, then refactor. All boxes are intentionally pending; planning does not complete implementation.

## 1. Preflight and reproducible deployment

- [ ] 1.1 Verify add-question-media-and-true-false is implemented and archived; record API hosting target, actual allowed UI origins, intended simultaneous classrooms, and agreed nickname/report retention before invitation.
- [ ] 1.2 Prepare a staging API deployment configuration for one Nest process, HTTPS/WSS endpoint and private persistent PostgreSQL; verify the API build, migrations, REST/Swagger routing, socket upgrades, and configured UI-origin access without serving frontend assets.
- [ ] 1.3 Add minimal readiness checks and credential-free operational signals where missing; verify database/process failures are visible without leaking tokens and document operator startup/rollback steps.
- [ ] 1.4 Rehearse database backup/restore against non-production data; verify quizzes and completed reports reopen after restore and document the tested procedure.

## 2. External UI contract and failure behavior

- [ ] 2.1 Document HTTP/OpenAPI and live-event interaction examples for the separate UI; verify authentication, error codes, phases, option labels, revisions, timing units, and submission acknowledgements match API tests.
- [ ] 2.2 Test configured/disallowed UI origins using REST preflight and Socket.IO connection requests with explicit Origin headers; verify configured-origin integration and rejected disallowed live handshakes, including the documented policy for clients without Origin.
- [ ] 2.3 Test restart/expiry restoration, synchronization, answers, and PIN reuse; implement any missing SESSION_UNAVAILABLE responses and verify no stale mutation or cross-room restoration while owners can retrieve saved data.
- [ ] 2.4 Rehearse client disconnection, host reauthentication, late answers, and storage failure against staging; verify explicit API acknowledgements/errors and record failure/recovery evidence.

## 3. Measure API capacity and deliver the integration handoff

- [ ] 3.1 Prepare and run real Socket.IO-client classroom workloads for one room of thirty and the provisional three-room/thirty-each target; verify expected acknowledgements, exact scoring, deadline rejection, room isolation, and record p95 acknowledgement latency/resource use.
- [ ] 3.2 Resolve any workload failures within this change's scope, rerun affected checks, and document only the supported measured envelope; verify the documented limit matches the pilot's agreed simultaneous classroom demand.
- [ ] 3.3 Deliver API operator/integration notes with workload limits, retention, restart limitations, and contract examples; verify an API host/thirty-guest mixed-game rehearsal including reconnect and report retrieval, and record UI/product rehearsal as external follow-up.
- [ ] 3.4 Assemble API release evidence for the build, relevant suites on a dedicated test database, origin/contract checks, workload, and backup/restore; verify each API acceptance checkpoint has actual evidence and no UI completion claim.

## Workflow follow-up

- Published issue tracking: [#62](https://github.com/CusmaLinux/robinhoot/issues/62) — 1.1–1.4; [#63](https://github.com/CusmaLinux/robinhoot/issues/63) — 2.1–2.2; [#64](https://github.com/CusmaLinux/robinhoot/issues/64) — 2.3–2.4; [#65](https://github.com/CusmaLinux/robinhoot/issues/65) — 3.1–3.2; [#66](https://github.com/CusmaLinux/robinhoot/issues/66) — 3.3–3.4. See [issue map](../../../docs/mvp-issue-map.md) for blockers and classification. Issue creation does not complete these tasks.

- Review the implemented diff and acceptance evidence before archiving this change.
- Archive after API implementation/verification and documented contract handoff, then confirm its requirements are present in main specs; UI completion is tracked separately.
- Reconcile the next change against the resulting main specs before applying it.

- Link related UI issues in the separate repository once their real URLs are known; screen implementation, browser accessibility, and joint professor rehearsal are external product follow-up.
