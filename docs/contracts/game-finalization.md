# Durable game finalization — API/UI contract

Issue [#58](https://github.com/CusmaLinux/robinhoot/issues/58) implements tasks
2.1–2.4 of `finish-game-with-results`. It builds on the
[HTTP quiz/room setup and Socket.IO progression contract](game-progression.md).
Issue #59 adds [owned history, restart discovery and ten-minute finished-room cleanup](report-history.md).

## Finish command and event

At the **last question reveal**, the currently bound owner sends `host.finish`
on the default Socket.IO namespace using handshake `auth.token`. Every request
revalidates the account JWT. The shape matches `host.start`/`host.next`: exactly
`roomId`, `commandId` (UUIDs) and `expectedRevision` (nonnegative safe integer).
Read the revision with `state.sync`. For example:

```javascript
// First create/save the quiz and POST /rooms as in the progression walkthrough.
const state = await host.timeout(7000).emitWithAck('state.sync', { roomId });
const command = {
  roomId,
  commandId: crypto.randomUUID(),
  expectedRevision: state.data.revision,
};
const result = await host.timeout(7000).emitWithAck('host.finish', command);
// On an ack timeout, resend this exact command, including its original revision.
// On REPORT_SAVE_FAILED, retry it after storage recovers.
```

While storage is pending, the public phase remains `question_reveal` and a
`state.sync` snapshot includes `finalizing:true`. Scores and revision do not
change. New answer, start, next and cancel mutations fail with
`FINALIZATION_IN_PROGRESS`. Concurrent valid finish requests share the same
write. Host-absence callbacks cannot cancel this pending attempt.

After the PostgreSQL transaction commits, the room transitions once to
`phase:finished` with one additional revision. The acknowledgement is
`{ok:true,data:{roomId,revision,phase:"finished",report}}`. Subscribed host and
current guests receive `game.finished` with the same `data` object. This is the
FINISHED announcement; it is never sent speculatively. The event is scoped to
the room channel. Restored/synchronized participants see the same report through
their current room session. Answers, next/start, and cancellation are rejected
after completion. A finished session retains the final question's reveal fields
and the guest's own accepted answer and cumulative score.

Retrying an acknowledged finish returns the stored report without a second
write or event. At finished, a new finish command also returns that report;
its revision does not create a new transition. The original finish command ID
with a changed revision is `COMMAND_CONFLICT`, as is reuse of a start/next ID.
Use the original command on retries. Its accepted fingerprint is checked before
the revision guard, so guest reconnection after a failed save cannot invalidate
that retry. A successful save whose response was lost
is resolved by reading the existing room report on the next storage attempt.

## Version 1 report facts

The report ID equals the room UUID. PostgreSQL stores one row keyed by
`room_id`, indexed by `owner_id`, with the versioned JSONB `document`. No foreign
key to a source quiz or account can cascade-delete results. `saveOnce` inserts
or reads the original owned row; later candidate differences do not overwrite
it. A transaction bounds each SQL statement to five seconds and rolls back on
failure; connection acquisition has a five-second timeout. Transport examples
use seven seconds to allow an error acknowledgement after a blocked statement.
These are server-side bounds, not a guarantee against arbitrary network stalls.

```json
{
  "version": 1,
  "id": "ac8c4643-7df3-49f1-8718-d3ccfa37bc43",
  "roomId": "ac8c4643-7df3-49f1-8718-d3ccfa37bc43",
  "ownerId": "92f9f897-cfb7-4802-9a3a-e1e38c66b865",
  "completedAt": "2026-10-27T16:00:00.000Z",
  "quiz": {
    "version": 1,
    "sourceQuizId": "770aaed8-2419-4249-8354-c9ba21b9ef53",
    "title": "Cells",
    "questions": [
      {
        "id": "a549c315-20c4-4697-837a-7707a1db1248",
        "type": "multiple-choice",
        "prompt": "Which cell has a nucleus?",
        "options": [
          { "id": "3b3041fa-dc31-4828-8297-ba0612f3cfbb", "text": "Animal" },
          { "id": "1a94df56-d405-44ca-972e-f98501d8c333", "text": "Bacterium" },
          { "id": "ce8efca5-2376-4aab-964b-e54bb36463b6", "text": "Virus" },
          { "id": "d7412189-65f3-4a45-9361-71dca892d7ea", "text": "None" }
        ],
        "correctOptionIds": ["3b3041fa-dc31-4828-8297-ba0612f3cfbb"],
        "durationSeconds": 20
      }
    ]
  },
  "standings": [
    { "playerId": "alice", "nickname": "Alice", "total": 1000, "rank": 1 },
    { "playerId": "bob", "nickname": "Bob", "total": 1000, "rank": 1 },
    { "playerId": "carol", "nickname": "Carol", "total": 0, "rank": 3 }
  ],
  "questions": [
    {
      "questionId": "a549c315-20c4-4697-837a-7707a1db1248",
      "eligible": 3,
      "correct": 2,
      "incorrect": 0,
      "missing": 1,
      "accuracy": 66.66666666666666
    }
  ]
}
```

Player IDs above are shortened for readability; live IDs are server-issued UUIDs.
The quiz is copied from the immutable room snapshot in its original order.
Totals sum frozen revealed-round scores. Equal totals share competition ranks
(1,1,3); normalized NFKC/lowercase nickname order stabilizes ties, with player ID
as the final deterministic ordering key. It never breaks rank ties.

Every question uses the initial eligible roster, including offline players.
`missing = eligible - correct - incorrect`; `accuracy` is a percentage from
0 to 100, calculated without rounding. One correct, one wrong and two missing
answers give `{eligible:4,correct:1,incorrect:1,missing:2,accuracy:25}`.
Lower accuracy means greater difficulty; the UI owns chart sorting/rendering.
No guest credentials, verifiers, connection IDs, account emails, or answer
receipts are persisted in the report. Returned report objects are deeply frozen
inside the API process.

## Errors and retry policy

Failures use `{ok:false,error:{code,message}}`, with `retryable:true` additionally
on `REPORT_SAVE_FAILED`:

```json
{
  "ok": false,
  "error": {
    "code": "REPORT_SAVE_FAILED",
    "message": "Report storage unavailable; retry host.finish with the same command",
    "retryable": true
  }
}
```

| Code                       | Meaning                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| `UNAUTHORIZED`             | Missing, invalid, expired or revoked owner JWT                       |
| `FORBIDDEN`                | Foreign owner or wrong room/actor binding                            |
| `SESSION_REPLACED`         | Connection no longer controls the host                               |
| `INVALID_PAYLOAD`          | Invalid UUID/revision or unexpected properties                       |
| `WRONG_PHASE`              | Finish before last reveal; mutation after completion                 |
| `STALE_REVISION`           | A new finalization targets an outdated reveal revision               |
| `COMMAND_CONFLICT`         | Progression ID reused for finish or original finish revision changed |
| `FINALIZATION_IN_PROGRESS` | Mutating command while the save is pending                           |
| `REPORT_SAVE_FAILED`       | No completion announced; retry the same finish command               |
| `ROOM_CLOSED`              | Cancellation already won; the room cannot be finalized               |

On save failure, retain the same frozen candidate (including completion time),
question state, and scores. Normal cancellation becomes available again.
Reevaluate any elapsed host-absence deadline immediately; an expired absence
cancels instead of leaving an orphaned reveal. If the deadline is still in the
future, rearm it. Successful persistence permanently disarms host-timeout
cancellation for that finished room. An ambiguous storage failure can leave a
durable report, which the idempotent retry returns; it never yields both a
cancellation broadcast and a completion broadcast for the same attempt.

A backend crash does not recover unsaved live rooms. Successfully saved reports
remain in PostgreSQL and are discoverable through [owned history](report-history.md).
The additive report migration refuses automatic down-migration to protect
saved results; disable new finalization and back up/export results before any
manual rollback. No production migration or deployment is part of this PR.

## Verification and handoff

[Domain facts](../../src/room/domain/game-report.spec.ts),
[application/fake-time tests](../../src/room/application/services/finish-game.service.spec.ts),
[real PostgreSQL tests](../../test/game-report.repository.spec.ts), and
[real HTTP/Socket.IO tests](../../test/lobby.gateway.e2e-spec.ts) cover stable
ranking/counts, concurrent writes, blocked-write rollback, save failure,
lost storage/ack responses, authorization and cancellation/host-absence races.
Database tests require an explicitly named `*_test` database. The separate UI
owns the final screen, retry messaging, standings and difficulty visualization.
