# Tasks

Work one tested behavior at a time: failing test, minimal implementation, then refactor. All boxes are intentionally pending; planning does not complete implementation.

## 1. Advance through the snapshot

- [x] 1.1 Verify play-live-question is implemented and archived; reconcile actual phase/revision behavior before extending the transition contract.
- [x] 1.2 Test next from reveal then implement the owner-only next-question API command; verify fixed snapshot order and fresh per-question deadlines.
- [x] 1.3 Test next retries, non-owner next, next while open, and next after the final question; verify no skipping/resetting and document progression errors.
- [x] 1.4 Test and implement explicit early ending with cancellation feedback; verify no completed report is created and all further answers/progression are rejected.

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

Issue #57 evidence (2026-10-26): verified the merged predecessor (#56 at
`08b8b9c`, diagram correction `8c3c4d3`) with 160 unit / 128 integration /
104 e2e tests, build, type, formatting, read-only lint and strict OpenSpec
validation. Synced six `live-gameplay` requirements to main and archived the
full predecessor as `2026-10-26-play-live-question` before implementing next;
re-read the actual resulting main specification. The archive's relative
contract/source links were adjusted for its deeper location.

One-test/minimal-implementation cycles cover fresh next duration, historical
start/next retries, cumulative scores, old accepted-answer receipts, and the
new real `host.next` event. Additional fake-time cases verify phase/revision/
command conflicts, foreign/replaced hosts, final-question guard, disconnected
eligibility, new old-question rejection, and cancellation during later open
and reveal with timer cleanup and stale callbacks. Real HTTP plus independent
host/two-guest sockets verify safe opening parity, retry, competing commands,
JWT revocation, invalid payloads, score/receipt restoration across two questions,
and terminal cancellation feedback with later answer/progression/restore denial.
Cancellation reuses the existing lifecycle and creates no completed report;
there is no report repository or completion writer in this slice.

See [wire contract and two-question examples](../../../docs/contracts/game-progression.md),
[component/sequence/state documentation](../../../docs/architecture/live-question.md),
[fake-time verification](../../../src/room/application/services/live-question.service.spec.ts),
and [real transport acceptance](../../../test/lobby.gateway.e2e-spec.ts).

Tasks 1.1–1.4 are complete (4/12 overall). Keep the remaining eight tasks and
archival pending for #58–#59. API/UI handoff is documented; UI implementation,
production database changes, merging, and deployment are outside this slice.

Final verification: 176 unit tests / 20 suites, 128 integration tests / four
suites, and 118 e2e tests / two suites pass. The final shared command path is
also covered by 44 targeted transport cases. Build, TypeScript, formatting,
strict validation of all twelve active/main OpenSpec items, local documentation
links, and whitespace checks pass. Read-only ESLint has zero errors and only
the two existing auth-test warnings. Database-backed checks use exclusively
`robinhoot_issue54_test` on loopback port 55454 with dedicated test credentials
and an explicit test JWT secret. Measured unit coverage for the live-question
service is 95% statements / 90% branches / 100% functions. Combined measured
unit/transport coverage gives the advisory Fallow audit a pass with zero
dead-code, complexity, or duplication findings. Architecture boundaries remain
unconfigured in Fallow; domain dependencies, synchronous room mutation, Symbol
DI, and transport/application direction were reviewed directly in the diff.
