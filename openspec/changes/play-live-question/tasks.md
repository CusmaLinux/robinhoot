# Tasks

Work one tested behavior at a time: failing test, minimal implementation, then refactor. All boxes are intentionally pending; planning does not complete implementation.

## 1. Start a round

- [ ] 1.1 Verify add-game-lobby is implemented and archived; reconcile actual gateway identity, receipt, and state contracts with this design before editing.
- [ ] 1.2 Test owner-only start with a nonempty roster, then implement first-question opening through clock/scheduler ports; verify frozen eligibility, one deadline, and rejection of late new admissions.
- [ ] 1.3 Document and test role-specific opening payloads containing four labeled options, serverNow/deadline with units, phase, and revision; verify public payloads omit correctness.
- [ ] 1.4 Test start retries and invalid-phase/empty-lobby starts; verify no deadline reset or second round and document the start event.

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
