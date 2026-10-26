# Tasks

Work one tested behavior at a time: failing test, minimal implementation, then refactor. All boxes are intentionally pending; planning does not complete implementation.

## 1. Start a round

- [x] 1.1 Verify add-game-lobby is implemented and archived; reconcile actual gateway identity, receipt, and state contracts with this design before editing.
- [x] 1.2 Test owner-only start with a nonempty roster, then implement first-question opening through clock/scheduler ports; verify frozen eligibility, one deadline, and rejection of late new admissions.
- [x] 1.3 Document and test role-specific opening payloads containing four labeled options, serverNow/deadline with units, phase, and revision; verify public payloads omit correctness.
- [x] 1.4 Test start retries and invalid-phase/empty-lobby starts; verify no deadline reset or second round and document the start event.

## 2. Accept exactly one timed answer

- [ ] 2.1 Test one valid answer then implement session-bound answer acceptance and acknowledgement; verify room/question/option validation without trusting a submitted player identity.
- [ ] 2.2 Test lost acknowledgement and identical retries before/after closure, then implement receipt lookup and payload conflict detection; verify at-most-one accepted answer and no duplicate score.
- [ ] 2.3 Test the exact deadline, delayed timer callback, forged identity, and old-question submission separately; verify all are rejected without state changes and document the stable error codes.
- [ ] 2.4 Document and test accepted/rejected submission acknowledgements and restored accepted-answer state; verify a client can determine acceptance without receiving early correctness and a different second answer is rejected.

## 3. Close, reveal, and restore

- [ ] 3.1 Test deadline closure and fixed scoring, then implement a one-time reveal transition; verify correct answers get 1000 once, missing/wrong answers get zero, and all-answered does not close early.
- [ ] 3.2 Test full-state restoration after submitting and after reveal; implement consistent revisioned API snapshots and verify current phase/receipt data and rejection of new submissions for a closed question.
- [ ] 3.3 Test host loss during a round and reauthentication/timeout using fake time; verify the question closes on time, progression waits, and 120-second absence cancels.
- [ ] 3.4 Run one complete API round with a host and two independent Socket.IO clients, including acknowledgement loss/reconnect; record API acceptance evidence, document events, and verify relevant suites, the API build, and architecture boundaries.

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
