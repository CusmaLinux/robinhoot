# Owned report history — API/UI contract

Issue [#59](https://github.com/CusmaLinux/robinhoot/issues/59) completes tasks
3.1–3.4 of `finish-game-with-results`. The API stores reports before announcing
completion; see [finalization and the version-1 document](game-finalization.md).

## Account-authenticated history

`GET /reports` returns an array of the authenticated account's complete version-1 or version-2
report documents, ordered by `completedAt` descending and report UUID ascending
for equal timestamps. No reports returns `[]`. This MVP endpoint has no pagination
or filter parameters. `GET /reports/:id` returns one original document; IDs are
room UUIDs. Both endpoints require `Authorization: Bearer <account access token>`.
The Swagger `/api` documentation includes both response schemas and all count fields.

```javascript
const headers = { Authorization: `Bearer ${accountToken}` };
const reports = await fetch(`${apiUrl}/reports`, { headers }).then((r) =>
  r.json(),
);
const report = await fetch(`${apiUrl}/reports/${reportId}`, { headers }).then(
  (r) => r.json(),
);
// report equals the original game.finished.report (version 1 or 2).
```

Owner identity comes only from the validated account token. Another user or admin
sees only their own list and gets the same `404` for foreign and nonexistent UUIDs:

```json
{ "statusCode": 404, "code": "REPORT_NOT_FOUND", "message": "Report not found" }
```

A malformed report UUID returns `400`. Missing, invalid, expired or revoked
account tokens return `401`. Current and expired guest room credentials also
return `401`; a PIN, nickname or room ID grants no historical authority.

## Standings and difficulty examples

After HTTP quiz/room creation, join guests through `lobby.join`, run
`host.start`, let each deadline reveal, advance with `host.next`, and send
`host.finish` at the final reveal. Use current revisions from `state.sync` and
UUID command IDs. The [progression walkthrough](game-progression.md) documents
setup and commands; [finalization](game-finalization.md) documents save errors
and exact-command retries. Both host and current subscribed guests receive
`game.finished`; `state.sync` recovers the same report if they miss the event.

A two-question game with Alice and Bob answering both questions correctly and
Carol answering only the first produces this standings projection (player IDs
omitted here for readability):

```json
[
  { "nickname": "Alice", "total": 2000, "rank": 1 },
  { "nickname": "Bob", "total": 2000, "rank": 1 },
  { "nickname": "Carol", "total": 1000, "rank": 3 }
]
```

Equal totals share rank. NFKC/lowercase nickname ordering stabilizes tied rows;
player ID is the final ordering key. Nickname order never changes rank.

With four eligible players, one correct answer, one wrong answer and two missing
answers on question one, and three correct/one missing on question two, the
question-count projection is:

```json
[
  {
    "questionId": "<first UUID>",
    "eligible": 4,
    "correct": 1,
    "incorrect": 1,
    "missing": 2,
    "accuracy": 25
  },
  {
    "questionId": "<second UUID>",
    "eligible": 4,
    "correct": 3,
    "incorrect": 0,
    "missing": 1,
    "accuracy": 75
  }
]
```

These are chart-ready facts in snapshot order. Join `questionId` to
`report.quiz.questions[].id` for original prompts/options. Accuracy is an
unrounded percentage: `correct / eligible * 100`; missing is
`eligible - correct - incorrect`. The roster freezes at game start, so offline
players remain in every denominator. The first question is harder because 25 is
less than 75. For a difficulty view sort ascending by accuracy; equal percentages
are equally difficult. The separate UI owns sorting, chart rendering, history
screens and final screens.

## Durability and finished-session lifetime

PostgreSQL stores immutable snapshot content, scores and counts independently of
source quizzes and process-local rooms. Source edits/deletion and backend restart
do not change saved documents. History does not depend on a live room, source
lookup, guest credential or timer. If a backend dies after a successful report
write but before completion acknowledgement, the owner can discover it in history.

Finished live rooms remain available for **ten minutes from successful
finalization**. Reconnection, state reads and finish retries do not extend this
window. At the boundary, a timer or the next checked live operation releases
room credentials, private answer/command receipts, owner/PIN indexes and lifecycle
timers. Cleanup does not emit cancellation or delete PostgreSQL reports. Old live
operations fail; expired room credentials cannot be promoted to history access.
An owner can create a fresh room after cleanup. Restart drops live rooms earlier;
only stored reports survive. Durable report deletion/retention is a separate
operational policy to settle before the professor pilot.

## Acceptance evidence and UI handoff

The automated acceptance record uses real HTTP, Socket.IO clients and the dedicated
PostgreSQL test database:

- [History HTTP tests](../../test/report.controller.spec.ts): owned listing/read,
  foreign user/admin isolation, account revocation, malformed IDs, stable history
  ordering, OpenAPI schemas, and committed report retrieval through a fresh backend
  after source deletion.
- [Full-game socket tests](../../test/lobby.gateway.e2e-spec.ts): exact 2000/2000/1000
  scores and 1/1/3 ranks; four-player 25/75 percent facts returned identically through
  guest completion and owner history; retryable save failure then successful finish;
  current/expired room-credential HTTP denial; ten-minute cleanup with saved report
  preservation. Existing cases also verify lost storage/ack responses and cancellation
  races.
- [Lifecycle fake-time tests](../../src/room/application/services/lobby-lifecycle.service.spec.ts):
  exact retention boundary, no extension on host return, delayed cleanup callbacks,
  timer/index release and stale callbacks unable to delete a replacement room.

This is the API contract handoff. UI implementation and shared professor rehearsal
remain in the separate UI repository; no UI issue URL is invented here.

See [True/False and report compatibility](true-false.md) for mixed snapshots and the version-2 contract.

## Optional image metadata

See [question images](question-images.md) for optional `imageUrl` /
`imageDescription`, syntactic HTTPS validation, safe projections, immutable
reference snapshots, compatibility and the API/UI handoff. The API never fetches images.
