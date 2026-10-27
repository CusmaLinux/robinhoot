# Tasks

Work one tested behavior at a time: failing test, minimal implementation, then refactor. All boxes are intentionally pending; planning does not complete implementation.

## 1. Start a round

- [x] 1.1 Verify add-game-lobby is implemented and archived; reconcile actual gateway identity, receipt, and state contracts with this design before editing.
- [x] 1.2 Test owner-only start with a nonempty roster, then implement first-question opening through clock/scheduler ports; verify frozen eligibility, one deadline, and rejection of late new admissions.
- [x] 1.3 Document and test role-specific opening payloads containing four labeled options, serverNow/deadline with units, phase, and revision; verify public payloads omit correctness.
- [x] 1.4 Test start retries and invalid-phase/empty-lobby starts; verify no deadline reset or second round and document the start event.

## 2. Accept exactly one timed answer

- [x] 2.1 Test one valid answer then implement session-bound answer acceptance and acknowledgement; verify room/question/option validation without trusting a submitted player identity.
- [x] 2.2 Test lost acknowledgement and identical retries before/after closure, then implement receipt lookup and payload conflict detection; verify at-most-one accepted answer and no duplicate score.
- [x] 2.3 Test the exact deadline, delayed timer callback, forged identity, and old-question submission separately; verify all are rejected without state changes and document the stable error codes.
- [x] 2.4 Document and test accepted/rejected submission acknowledgements and restored accepted-answer state; verify a client can determine acceptance without receiving early correctness and a different second answer is rejected.

## 3. Close, reveal, and restore

- [x] 3.1 Test deadline closure and fixed scoring, then implement a one-time reveal transition; verify correct answers get 1000 once, missing/wrong answers get zero, and all-answered does not close early.
- [x] 3.2 Test full-state restoration after submitting and after reveal; implement consistent revisioned API snapshots and verify current phase/receipt data and rejection of new submissions for a closed question.
- [x] 3.3 Test host loss during a round and reauthentication/timeout using fake time; verify the question closes on time, progression waits, and 120-second absence cancels.
- [x] 3.4 Run one complete API round with a host and two independent Socket.IO clients, including acknowledgement loss/reconnect; record API acceptance evidence, document events, and verify relevant suites, the API build, and architecture boundaries.

## Workflow follow-up

- Published issue tracking: [#54](https://github.com/CusmaLinux/robinhoot/issues/54) — 1.1–1.4 and deadline closure portion of 3.1; [#55](https://github.com/CusmaLinux/robinhoot/issues/55) — 2.1–2.4 and scoring portion of 3.1; [#56](https://github.com/CusmaLinux/robinhoot/issues/56) — 3.2–3.4. See [issue map](../../../docs/mvp-issue-map.md) for blockers and classification. Issue creation does not complete these tasks.

- Review the implemented diff and acceptance evidence before archiving this change.
- Archive after API implementation/verification and documented contract handoff, then confirm its requirements are present in main specs; UI completion is tracked separately.
- Reconcile the next change against the resulting main specs before applying it.

- Link related UI issues in the separate repository once their real URLs are known; screen implementation, browser accessibility, and joint professor rehearsal are external product follow-up.

Issue #54 evidence (2026-10-26): predecessor #53 merged at `a9886dd`.
Before applying this slice, reviewed its implemented contract and acceptance
record, reran 117 unit / 128 integration / 65 e2e tests and build, synced the
`game-lobby` main specification, and archived the full predecessor as
`2026-10-26-add-game-lobby`. Re-read that main spec plus quiz-authoring,
user-auth, and jwt-guard; reconciliation is recorded in design.md.

Implemented first-question opening, immutable eligible player IDs, one accepted
start-command receipt, monotonic deadline, safe A–D labels, and one-time no-answer
reveal with zero points. Each new behavior followed failing-test/minimal-code
slices; subsequent boundary checks verify owner/current host authority, empty
roster, stale revision, command fingerprint conflicts, retry before/after reveal,
late admission, callback-before-read/read-before-callback ordering, repeated/early
callbacks, wall-clock jumps, idle-expiry handoff, cancellation and shutdown.
Real Socket.IO clients verify host/two-guest opening and automatic reveal,
private command reauthentication, revoked tokens, replaced host authority,
malformed/injected payloads, isolation, and start during delayed subscription.

Final verification: 138 unit tests / 20 suites, 128 integration tests / four
suites, 83 e2e tests / two suites; build, TypeScript, formatting, strict OpenSpec
validation, and whitespace checks pass. Full read-only ESLint has zero errors
and the two pre-existing auth-test warnings. Database-backed checks use only
`robinhoot_issue54_test` at loopback port 55454, dedicated test credentials,
and an explicit test JWT secret. The production question runtime has 100% unit coverage. Combined application
and real-client coverage was supplied to the advisory Fallow audit, which passes
with zero dead-code, complexity, or duplication findings.

See [wire contract and real-client example](../../../docs/contracts/live-question.md),
[component/sequence/state diagrams](../../../docs/architecture/live-question.md),
[fake-time suite](../../../src/room/application/services/live-question.service.spec.ts),
and [real-client acceptance](../../../test/lobby.gateway.e2e-spec.ts).
Application mutations remain synchronous and immutable; time/scheduling and
publication use Symbol ports. Architecture direction was reviewed manually;
Fallow's architecture boundaries are not configured. No production database,
schema migration, deployment, UI work, or external maintainer message.

Tasks 1.1–1.4 are complete. The deadline/no-answer portion of 3.1 is complete;
keep 3.1 pending for #55's answer acceptance and fixed nonzero scoring. Tasks
2.1–2.4 and 3.2–3.4 remain for #55–#56, including full active recovery acceptance.
Do not archive `play-live-question` until those slices and handoffs are verified.

Issue #55 evidence (2026-10-26): implemented session-bound `answer.submit`,
strict monotonic deadline rejection, one immutable receipt per player/question,
original accepted retries before/after reveal, and distinct second-answer/ID
conflicts. Reveal stores fixed 1000-or-zero scores exactly once without early
closure when everyone answers. Guest sync/restoration/reveal expose only the
receiving player's receipt/score; roster broadcasts cannot leak private choices.

One-test/minimal-implementation cycles covered initial acceptance, accepted
retries, second submissions, conflicting ID reuse, exact cutoff, scoring,
private snapshot receipts, real transport acceptance, lost-ack restoration,
and personalized reveal. Additional fake-time and transport cases verify invalid
room/question/option and identity fields, obsolete sessions, simultaneous
submissions, wrong/missing answers, wall-clock jumps, no early reveal, cancellation,
and conflicts after reveal. HTTP setup and Socket.IO event/ack examples plus
component/sequence/state documentation are updated in the linked contract docs.

Verification: 158 unit tests / 20 suites, 128 integration tests / four suites,
and 98 e2e tests / two suites pass. Build, TypeScript, formatting, strict
OpenSpec validation, and whitespace checks pass. Read-only ESLint reports zero
errors and only the two existing auth-test warnings. Database-backed checks
used only `robinhoot_issue54_test` on loopback port 55454 with dedicated test
credentials and an explicit test JWT secret. Combined unit and targeted real-client
coverage measures the live question service at 94.33% lines / 87.5% branches /
100% functions. Supplying that measured coverage resolves the advisory Fallow
estimate; its audit passes with zero dead-code, complexity, or duplication findings.
Architecture direction and Symbol DI were reviewed manually; automated boundary
rules remain unconfigured. No production database or migration is involved.

Tasks 2.1–2.4 and the remaining scoring portion of 3.1 are complete (9/12 total).
Keep 3.2–3.4 and archival pending for #56's full active recovery and handoff.

Issue #56 evidence (2026-10-26): predecessor #55 is merged at `972782b`.
Re-read the actual main predecessor specifications and this change's proposal,
design, delta specification, and tasks before editing. Added a failing regression
for a public host snapshot at the absence cutoff with cancellation callbacks
withheld, then enforced lifecycle availability for both role projections. The
public application snapshot now returns the retained closure error after room
cancellation, matching the existing guest behavior.

Fake-time checks verify delayed cutoff enforcement and owner return at 119999 ms
preserving the original scored reveal. Six additional real-client cases verify
unanswered restoration after reveal, reveal inside each of restore/sync/bind
subscription, the integrated host/two-guest recovery rehearsal, and failed expired
host return followed by exact-cutoff cancellation. The integrated flow includes
lost answer acknowledgement, guest disconnects, open/reveal restoration, role
privacy, rejected closed-question answers, foreign/expired host errors, and fresh
owner HTTP login. Contract transcripts and recovery sequence/state documentation
are linked from `docs/contracts/active-game-recovery.md`.

Verification: 160 unit tests, 128 integration tests, and 104 e2e tests pass.
Build, TypeScript, read-only ESLint (zero errors, only the two existing auth-test
warnings), formatting, strict change validation, and whitespace checks pass.
Database-backed suites use only `robinhoot_issue54_test` on loopback port 55454
with dedicated test credentials and an explicit test JWT secret. The production
change reuses the lifecycle port; domain dependencies, Symbol DI, synchronous
room mutation, and adapter boundaries remain intact, reviewed in the diff.
No schema migration, production database, UI implementation, or deployment.

Tasks 3.2–3.4 are complete (12/12 total). API verification and contract handoff are
recorded; retain the change for PR review before its separate final archival.
