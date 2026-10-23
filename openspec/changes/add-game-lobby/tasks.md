# Tasks

Work one tested behavior at a time: failing test, minimal implementation, then refactor. All boxes are intentionally pending; planning does not complete implementation.

## 1. Predecessor and owned room creation

- [ ] 1.1 Verify add-quiz-authoring is implemented and archived and re-read main specs/quiz APIs; update this change if its assumptions differ, recording the contract review.
- [ ] 1.2 Test one owned room-creation behavior then implement a versioned quiz snapshot and in-memory room port/adapter; verify edits/deletion of the source do not mutate the room.
- [ ] 1.3 Test invalid/foreign quiz creation, owner concurrency, PIN collision, and retried creation one behavior at a time; verify no duplicate room or PIN overwrite and document POST /rooms.
- [ ] 1.4 Document and test the create-room response and private host binding; verify HTTP creation returns a room ID/PIN for an owned hostable quiz without leaking answer keys.

## 2. Guest admission and safe roster

- [ ] 2.1 Add compatible Nest/Socket.IO dependencies with pnpm and explicit transport authentication; verify private HTTP endpoints stay protected and private host messages reject unauthenticated/foreign users.
- [ ] 2.2 Test guest join then implement join acknowledgement, nickname validation, thirty-player admission, and safe roster broadcasts; verify one host and two guests share an isolated lobby.
- [ ] 2.3 Test duplicate join request retries, duplicate nicknames, invalid PINs, full rooms, and admission throttling one at a time; verify clear errors and unchanged slot counts.
- [ ] 2.4 Document join/acknowledgement/roster event examples and test them with independent Socket.IO clients; verify explicit connection/session data and no other players' credentials or correct-answer metadata in public payloads.

## 3. Restore and close the lobby

- [ ] 3.1 Test credential-bound reconnect then implement atomic session subscription/state sync; verify reload retains identity and one slot while nickname/socket-ID impersonation and cross-room credentials fail.
- [ ] 3.2 Test host reauthentication, replacement-connection authority, thirty-minute expiry, owner cancellation, and 120-second host absence with fake time; verify cancellation reasons and cleanup of credentials/timers/receipts.
- [ ] 3.3 Document lifecycle/error codes and run an API host/two-guest reconnect test with real Socket.IO clients; verify room isolation, relevant suites, the API build, and architecture boundaries.

## Workflow follow-up

- Published issue tracking: [#50](https://github.com/CusmaLinux/robinhoot/issues/50) — 1.1–1.4; [#51](https://github.com/CusmaLinux/robinhoot/issues/51) — 2.1–2.4; [#52](https://github.com/CusmaLinux/robinhoot/issues/52) — 3.1 and reconnect-related 3.3 verification; [#53](https://github.com/CusmaLinux/robinhoot/issues/53) — 3.2–3.3. See [issue map](../../../docs/mvp-issue-map.md) for blockers and classification. Issue creation does not complete these tasks.

- Review the implemented diff and acceptance evidence before archiving this change.
- Archive after API implementation/verification and documented contract handoff, then confirm its requirements are present in main specs; UI completion is tracked separately.
- Reconcile the next change against the resulting main specs before applying it.

- Link related UI issues in the separate repository once their real URLs are known; screen implementation, browser accessibility, and joint professor rehearsal are external product follow-up.
