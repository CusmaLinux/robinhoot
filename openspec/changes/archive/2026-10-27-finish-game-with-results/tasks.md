# Tasks

Work one tested behavior at a time: failing test, minimal implementation, then refactor. All boxes are intentionally pending; planning does not complete implementation.

## 1. Advance through the snapshot

- [x] 1.1 Verify play-live-question is implemented and archived; reconcile actual phase/revision behavior before extending the transition contract.
- [x] 1.2 Test next from reveal then implement the owner-only next-question API command; verify fixed snapshot order and fresh per-question deadlines.
- [x] 1.3 Test next retries, non-owner next, next while open, and next after the final question; verify no skipping/resetting and document progression errors.
- [x] 1.4 Test and implement explicit early ending with cancellation feedback; verify no completed report is created and all further answers/progression are rejected.

## 2. Persist and announce completion

- [x] 2.1 Test deterministic report generation from a frozen roster, then implement report facts and competition ranking; verify 1,1,3 ties and disconnected-player denominators.
- [x] 2.2 Test an idempotent stored report write then add the report migration, repository port and Kysely adapter; verify one room ID yields one immutable report on the dedicated test database and document its versioned shape.
- [x] 2.3 Test owner finalization only at last reveal, then wire the stored report to the finish API command; verify FINISHED occurs only after successful persistence.
- [x] 2.4 Test save failure, concurrent finish, lost persistence response, cancellation races, and completion acknowledgement retry separately; verify stable one-report results and a retryable failure without false completion.

## 3. Retrieve report data

- [x] 3.1 Test owner-filtered list/read endpoints then implement GET /reports and /reports/:id; verify foreign user/admin and guest-credential historical reads are denied and document the API.
- [x] 3.2 Document and test final standings, owned history responses, and question difficulty data; verify a four-player 1-correct/1-wrong/2-missing response includes 25 percent accuracy and all counts for the separate UI's charts.
- [x] 3.3 Test report reload after source deletion/backend restart and bounded FINISHED-room cleanup; verify stored results remain readable while expired live credentials cannot retrieve history.
- [x] 3.4 Demonstrate a complete two-question game through HTTP/Socket.IO with report retrieval, tie behavior, and storage failure retry; record API evidence and verify relevant suites, the API build, and architecture boundaries.

## Workflow follow-up

- Published issue tracking: [#57](https://github.com/CusmaLinux/robinhoot/issues/57) — 1.1–1.4; [#58](https://github.com/CusmaLinux/robinhoot/issues/58) — 2.1–2.4; [#59](https://github.com/CusmaLinux/robinhoot/issues/59) — 3.1–3.4. See [issue map](../../../../docs/mvp-issue-map.md) for blockers and classification. Issue creation does not complete these tasks.

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

See [wire contract and two-question examples](../../../../docs/contracts/game-progression.md),
[component/sequence/state documentation](../../../../docs/architecture/live-question.md),
[fake-time verification](../../../../src/room/application/services/live-question.service.spec.ts),
and [real transport acceptance](../../../../test/lobby.gateway.e2e-spec.ts).

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


## Issue #58 implementation evidence (2026-10-27)

Tasks 2.1–2.4 implement owner finalization at the last reveal through
`host.finish`, one immutable owned PostgreSQL report per room, deterministic
competition ranks, frozen question snapshots and eligibility/count facts.
Completion is emitted as `game.finished` only after transaction commit.

One-behavior test/implementation cycles verified persistence ordering,
acknowledgement retry, concurrent finish coalescing, stable candidates after
save failure, cancellation suppression, expired/future host absence settlement,
and accepted-command retry after roster reconnection changes the revision.
Separate cases verify lost persistence responses, authority/revision/phase
errors, original command content conflicts, and post-failure cancellation.

Dedicated PostgreSQL tests use independent connections for concurrent first
inserts, conflicting retries and ownership collisions. A real exclusive table
lock verifies five-second statement timeout/rollback without report mutation.
Application transaction savepoints preserve each transport test's outer
rollback; database suites run sequentially so the intentional lock cannot
interfere with live-command tests. No production database was used.

Real HTTP-created quiz/room and Socket.IO host/guest clients verify completion
broadcasts, saved facts, two-question 1,1,3 totals, missing disconnected players,
storage/ack response loss, concurrent finish versus cancel/answer, restoration
retry and JWT/binding/payload errors. The versioned payload, errors, rollback
policy, API/UI handoff and component/sequence/state diagrams are documented in
[the finalization contract](../../../../docs/contracts/game-finalization.md) and
[the architecture](../../../../docs/architecture/live-question.md).

The additional integration file exceeded ESLint's eight-file fallback project
limit. Tests now have an explicit TypeScript project; three existing OpenAPI
assertions guard missing responses so the test project also type-checks.

Tasks 1.1–2.4 are complete (8/12 overall). Keep tasks 3.1–3.4 and archival
pending for #59: owned history, restart discovery, finished-room retention and
full history handoff remain there. Do not archive this partial overall change.

Final verification: 197 unit tests / 22 suites, 131 integration tests / five
suites, and 130 e2e tests / two suites pass. API build, source/test TypeScript
checks, formatting, documentation links, whitespace and strict validation of
all twelve active/main OpenSpec items pass. Read-only ESLint has zero errors
and the two pre-existing auth-test warnings. Database-backed checks used only
`robinhoot_issue58_test` at loopback port 55458 with dedicated test credentials.
Ports-and-adapters direction and Symbol DI were reviewed in the final diff;
domain report code has no framework, transport, or persistence imports.

### PR #79 Fallow follow-up (2026-10-27)

Reproduced the failing CI audit against base `f365092` using the CI log's
Fallow 3.36.0: four introduced complexity findings and two introduced clone
groups failed the new-only gate. Unit/e2e success alone did not satisfy that
gate because the audit job supplies no measured coverage and uses estimated
CRAP scores. Local stale coverage artifacts were preserved outside the project
during CI-equivalent audit checks and restored afterward.

Refactored answer target validation and accepted-answer retry lookup into
focused private helpers, preserving their order before deadline/phase checks.
Separated finish fingerprint/phase validation and finished-state projection
from persistence orchestration. Separated lifecycle expiration-reason decisions
from cancellation settlement. Host start/next/finish now share one validated
bound-owner input builder. The two-question transport test shares question and
answer helpers and retains its complete standings/count assertions; it also
asserts successful answer acceptance. Removed only the three dependency-ignore
entries Fallow identified as redundant. No audit thresholds, gates, suppressions
or workflow failure policies were weakened.

Final follow-up verification: Fallow 3.34.1 and 3.36.0 both pass the full PR
new-only audit against `f365092`, with zero introduced complexity, duplication,
dead-code, styling or diff-risk findings. Four complexity findings and one clone
group are inherited from the base. All 197 unit tests and all 130 e2e tests pass;
the e2e run used only the isolated `robinhoot_issue58_test` database. Build,
source/test TypeScript, formatting, whitespace, and read-only ESLint pass;
ESLint retains only the two existing auth-test warnings.


## Issue #59 implementation evidence (2026-10-27)

Tasks 3.1–3.4 are complete: 12/12 overall. Owner-filtered history now uses
account JWT identity and separate read ports with shared Kysely Symbol DI.
Foreign users/admins receive an indistinguishable missing/foreign 404; current
and expired room credentials cannot authenticate history. OpenAPI includes the
version-1 immutable report, snapshot, standings and all difficulty fields.

Real HTTP/Socket.IO acceptance verifies a complete two-question game, exact
2000/2000/1000 totals with 1/1/3 competition ranks, stable nickname ordering,
and four-player 25/75 percent question facts including disconnected players.
A storage failure returns a retryable error before the original finish retry
completes; owner history equals guest completion. Source edits/deletion and
fixed ten-minute FINISHED cleanup leave stored results unchanged. Independent
backend instances reopen committed reports after source deletion. Fake-time
checks verify the exact retention boundary, no extension on return, delayed
callbacks, timer/index release and stale callback isolation.

Final verification: 199 unit tests / 22 suites, 142 integration tests / six
suites, and 133 e2e tests / two suites pass. Build, test TypeScript, source/test
formatting, strict OpenSpec validation and whitespace checks pass. Read-only
ESLint has zero errors and the two existing auth-test warnings. Database-backed
checks exclusively use the dedicated loopback `robinhoot_issue58_test` database
on port 55458 with explicit test credentials and JWT secret. No production
migration or data access was performed.

The Fallow audit against `origin/main` passes with no introduced dead code,
complexity, duplication, styling or diff-risk findings. Its four inherited
complexity estimates remain advisory; no new suppression/configuration was
added. No import cycles were found. Architecture boundary/policy rules are
unconfigured, so those counts are not measured guarantees; imports, Symbol DI,
source-independent history and lifecycle/persistence separation were reviewed
directly.

The [history contract](../../../../docs/contracts/report-history.md) documents
ranking/difficulty examples, errors, response ordering, expiry, verification and
the API/UI handoff. Component, sequence and state diagrams are updated in
[the architecture](../../../../docs/architecture/live-question.md). API work is
ready for archival review; UI screens and charts, durable-data retention policy,
and joint professor rehearsal remain external follow-up. The change has not
been archived by this issue implementation.

## Stage-boundary archival — issue #60 (2026-10-27)

After #59 merged as `d208635`, reran 199 unit, 142 integration and 133 e2e
tests on the dedicated test database plus build, types, formatting, lint,
strict OpenSpec validation and audit. Reviewed the completed twelve tasks
and API handoff, synced all six progression/results requirements to main,
and archived this complete predecessor before applying the next format change.
