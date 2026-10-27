# Question progression and early cancellation — API/UI contract

Issue [#57](https://github.com/CusmaLinux/robinhoot/issues/57) extends the
[timed question contract](live-question.md). Create a hostable ordered quiz with
`POST /quizzes` and `PUT /quizzes/:id`, then create its frozen snapshot using
`POST /rooms` with `{quizId,requestId}` and owner bearer authentication. See the
[two-question HTTP walkthrough](quiz-authoring-walkthrough.md). Changing or
removing the source quiz cannot change the live question order or durations.

Use Socket.IO's default namespace, `/socket.io`. Bind the owner with
`host.bind {roomId}` using handshake `auth.token`; guests join or restore using
the [existing room credentials](lobby-restoration.md). Every private host command
revalidates its JWT and requires the current bound owner connection. Expired or
revoked tokens require owner login and binding again within the unchanged
120-second absence window.

## Open the next question

After `question.revealed`, obtain the latest revision with `state.sync`. Send
`host.next` with the same validated shape as `host.start`:

```json
{
  "roomId": "ac8c4643-7df3-49f1-8718-d3ccfa37bc43",
  "commandId": "dc874162-7300-4d30-9100-9f43a741bbf6",
  "expectedRevision": 6
}
```

Both IDs must be UUIDs; they are normalized to lowercase. The revision is a
nonnegative safe integer. Extra properties, including submitted actor IDs, fail
validation. Use a fresh command ID for each intentional transition. Send the
original ID **and revision** when retrying after acknowledgement loss.

Success is `{ok:true,data:<public question state>}` and one `question.opened`
event to the subscribed host and guests. The response uses the next question
from the room snapshot, `phase:question_open`, and one additional revision.
`openedAt` is the current Unix millisecond time, `deadline` is that time plus the
next question's full duration in milliseconds, and `serverNow` uses the same
units. A 30-second second question opened at 1793034030000 has deadline
1793034060000 even if the host waited at reveal. A separate monotonic deadline
enforces answer cutoff regardless of wall-clock jumps or delayed callbacks.

The initial eligible roster remains frozen, including offline players. Each new
question begins with no accepted answers. Opening broadcasts remain public:
`score:0`, A–D labeled options, no correct option, guest receipt, internal clock,
command history, or credentials. Guest `state.sync`/`session.restore` and private
`question.revealed` return only that player's cumulative score and the current
question's `acceptedAnswer` (initially null). An accepted old-question answer
retry returns its original receipt; new old-question answers are rejected.
Correct answers add 1000 once at each reveal; wrong/missing answers add zero.

Accepted start/next IDs and fingerprints remain available for the live room
lifetime, bounded by its maximum twenty questions. An accepted retry returns
**current** public state, including a later question or reveal, without another
opening, revision, score, or deadline reset. Reusing an ID with a changed revision
or another command type is `COMMAND_CONFLICT`. Concurrent new commands cannot
skip a question: one opens it and the other sees the new phase. A retry may
settle a due reveal, just as state synchronization does.

| Code                | Meaning                                               |
| ------------------- | ----------------------------------------------------- |
| `UNAUTHORIZED`      | Missing, expired, invalid, or revoked owner JWT       |
| `FORBIDDEN`         | Foreign account or wrong room/role binding            |
| `SESSION_REPLACED`  | Obsolete host connection                              |
| `INVALID_PAYLOAD`   | Invalid UUID/revision or unexpected properties        |
| `WRONG_PHASE`       | New next command in lobby or while a question is open |
| `STALE_REVISION`    | New next command at reveal with an outdated revision  |
| `COMMAND_CONFLICT`  | Accepted command ID reused with changed content/type  |
| `NO_MORE_QUESTIONS` | New next command after the final question's reveal    |
| `WRONG_QUESTION`    | New answer for an old or different question           |
| `ROOM_CLOSED`       | Cancellation invalidated the live game                |

Failures use `{ok:false,error:{code,message}}`. At final reveal the game awaits
later owner action; next cannot complete it. Durable completion is now implemented by #58; see the
[finalization contract](game-finalization.md). Owned history remains #59.

## End early

The existing `host.cancel {roomId,commandId}` accepts UUIDs and works in lobby,
open, or reveal, including the final reveal before completion. Example response
and `lobby.closed` broadcast to each subscribed participant:

```json
{
  "ok": true,
  "data": {
    "roomId": "ac8c4643-7df3-49f1-8718-d3ccfa37bc43",
    "revision": 9,
    "phase": "closed",
    "reason": "OWNER_CANCELLED"
  }
}
```

The broadcast contains only the `data` object. Closure cancels pending timers,
removes the room, roster, command/answer history, scores and owner/PIN indexes,
and removes channel subscriptions. It creates no completed report and emits no
completion event. Later answers (including accepted retries), start/next, sync,
and restoration fail with `ROOM_CLOSED` and retained reason `OWNER_CANCELLED`.
The existing bounded five-minute tombstone returns the same closure on owner
cancellation retries without a second broadcast. After tombstone expiry, live
room credentials cannot recover erased state. Foreign accounts and guests
cannot cancel. Host absence retains its existing `HOST_TIMEOUT` cancellation.

## Two-question transcript

With two guests already admitted and the host bound, use the HTTP-created room
above. The following `ack` helper throws the returned error code:

```javascript
import { randomUUID } from 'node:crypto';
const ack = async (socket, event, payload) => {
  const result = await socket.timeout(3000).emitWithAck(event, payload);
  if (!result.ok) throw new Error(result.error.code);
  return result.data;
};
const read = () => ack(host, 'state.sync', { roomId: room.roomId });
const command = async () => ({
  roomId: room.roomId,
  commandId: randomUUID(),
  expectedRevision: (await read()).revision,
});
const start = await command();
await ack(host, 'host.start', start);
// Wait for question.revealed: guests receive only their own receipt/total.
const next = await command();
const second = await ack(host, 'host.next', next);
console.log(second.phase, second.deadline - second.openedAt); // question_open, 30000
console.log(await ack(host, 'host.next', next)); // unchanged current question
// A fresh host.next while open -> WRONG_PHASE.
// At second reveal: a fresh host.next -> NO_MORE_QUESTIONS.
// The accepted next retry still returns second reveal.
console.log(
  await ack(host, 'host.cancel', {
    roomId: room.roomId,
    commandId: randomUUID(),
  }),
); // closed, OWNER_CANCELLED; all subscribed actors receive lobby.closed
// Later next/answer.submit/session.restore -> ROOM_CLOSED, OWNER_CANCELLED.
```

The [real transport suite](../../test/lobby.gateway.e2e-spec.ts) creates quizzes
and rooms over HTTP, then uses independent host/two-guest sockets and an injected
clock. It verifies ordered opening/full duration, safe event parity, retries,
authorization/replaced host/revocation, malformed input, competing next commands,
final-question errors, and cancellation at later open/reveal. The
[fake-time suite](../../src/room/application/services/live-question.service.spec.ts)
adds three-question receipt retention, cumulative scoring, frozen offline
eligibility, historical answer retries, timer cleanup, and stale callbacks.
Screens and client retry/countdown presentation belong to the separate UI repo.
