# Tasks

Work one tested behavior at a time: failing test, minimal implementation, then refactor. All boxes are intentionally pending; planning does not complete implementation.

## 1. Advance through the snapshot

- [ ] 1.1 Verify play-live-question is implemented and archived; reconcile actual phase/revision behavior before extending the transition contract.
- [ ] 1.2 Test next from reveal then implement the owner-only next-question API command; verify fixed snapshot order and fresh per-question deadlines.
- [ ] 1.3 Test next retries, non-owner next, next while open, and next after the final question; verify no skipping/resetting and document progression errors.
- [ ] 1.4 Test and implement explicit early ending with cancellation feedback; verify no completed report is created and all further answers/progression are rejected.

## 2. Persist and announce completion

- [ ] 2.1 Test deterministic report generation from a frozen roster, then implement report facts and competition ranking; verify 1,1,3 ties and disconnected-player denominators.
- [ ] 2.2 Test an idempotent stored report write then add the report migration, repository port and Kysely adapter; verify one room ID yields one immutable report on the dedicated test database and document its versioned shape.
- [ ] 2.3 Test owner finalization only at last reveal, then wire the stored report to the finish API command; verify FINISHED occurs only after successful persistence.
- [ ] 2.4 Test save failure, concurrent finish, lost persistence response, cancellation races, and completion acknowledgement retry separately; verify stable one-report results and a retryable failure without false completion.

## 3. Retrieve report data

- [ ] 3.1 Test owner-filtered list/read endpoints then implement GET /reports and /reports/:id; verify foreign user/admin and guest-credential historical reads are denied and document the API.
- [ ] 3.2 Document and test final standings, owned history responses, and question difficulty data; verify a four-player 1-correct/1-wrong/2-missing response includes 25 percent accuracy and all counts for the separate UI's charts.
- [ ] 3.3 Test report reload after source deletion/backend restart and bounded FINISHED-room cleanup; verify stored results remain readable while expired live credentials cannot retrieve history.
- [ ] 3.4 Demonstrate a complete two-question game through HTTP/Socket.IO with report retrieval, tie behavior, and storage failure retry; record API evidence and verify relevant suites, the API build, and architecture boundaries.

## Workflow follow-up

- Published issue tracking: [#57](https://github.com/CusmaLinux/robinhoot/issues/57) — 1.1–1.4; [#58](https://github.com/CusmaLinux/robinhoot/issues/58) — 2.1–2.4; [#59](https://github.com/CusmaLinux/robinhoot/issues/59) — 3.1–3.4. See [issue map](../../../docs/mvp-issue-map.md) for blockers and classification. Issue creation does not complete these tasks.

- Review the implemented diff and acceptance evidence before archiving this change.
- Archive after API implementation/verification and documented contract handoff, then confirm its requirements are present in main specs; UI completion is tracked separately.
- Reconcile the next change against the resulting main specs before applying it.

- Link related UI issues in the separate repository once their real URLs are known; screen implementation, browser accessibility, and joint professor rehearsal are external product follow-up.
