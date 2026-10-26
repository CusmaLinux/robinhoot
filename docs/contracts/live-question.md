# Timed first question — API/UI contract

Issue [#54](https://github.com/CusmaLinux/robinhoot/issues/54) adds a no-answer
round. Use the existing HTTP room creation and Socket.IO default namespace at
`/socket.io`. See [room creation](room-creation.md), [admission](lobby-admission.md),
and [host lifecycle](lobby-lifecycle.md) for authentication and room setup.

## Start and timing

The authenticated owner first sends `host.bind {roomId}` with the current JWT in
handshake `auth.token`. Then send:

```json
{
  "roomId": "ac8c4643-7df3-49f1-8718-d3ccfa37bc43",
  "commandId": "dc874162-7300-4d30-9100-9f43a741bbf6",
  "expectedRevision": 2
}
```

Event: `host.start`. UUIDs are normalized to lowercase. `expectedRevision` must
be a nonnegative safe integer from the latest room snapshot. Extra fields,
including submitted actor identities, are rejected. Each private host message
revalidates the token and checks current connection authority and ownership.
At least one joined player is required; offline reserved players remain eligible.

The acknowledgement is `{ok:true,data:<question state>}`. The room broadcasts
`question.opened` to its subscribed host and guests using the same safe question
projection. Example (UUIDs shortened here only for readability):

```json
{
  "roomId": "room-uuid",
  "questionId": "question-uuid",
  "revision": 3,
  "phase": "question_open",
  "question": {
    "id": "question-uuid",
    "type": "multiple-choice",
    "prompt": "Which answer?",
    "options": [
      {"id":"option-a-uuid","label":"A","text":"First"},
      {"id":"option-b-uuid","label":"B","text":"Second"},
      {"id":"option-c-uuid","label":"C","text":"Third"},
      {"id":"option-d-uuid","label":"D","text":"Fourth"}
    ]
  },
  "eligiblePlayerIds": ["alice-uuid", "bob-uuid"],
  "openedAt": 1793034000000,
  "deadline": 1793034020000,
  "serverNow": 1793034000000,
  "timeUnit": "milliseconds",
  "score": 0
}
```

`openedAt`, `deadline`, and `serverNow` are Unix epoch **milliseconds**. The
snapshot question's `durationSeconds` is converted to milliseconds once on
opening. The server uses a separate monotonic millisecond clock for the actual
cutoff, so wall-clock adjustments cannot extend or shorten the round. Clients
estimate countdown from server timing; only the server determines closure.

Host and guest opening views contain the same public question and frozen player
IDs. Both omit correct options, correctness flags, credentials, command receipts,
owner identity, and internal monotonic clock values. `score:0` is the receiving
actor's no-answer score placeholder in this slice; there are no accepted answers
or nonzero scores yet. Public roster snapshots retain only display identity and
connection status. No other player's private submission data is exposed.

## Reveal and retries

At the deadline the room broadcasts `question.revealed` with the same shape,
`phase:"question_reveal"`, one additional revision, and
`correctOptionIds:["option-b-uuid"]`. `deadline` and `openedAt` are unchanged;
`serverNow` reflects the current server wall clock. Missing answers earn zero.
Repeated or stale callbacks cannot reveal again. A delayed callback is also
settled by a current state read or accepted start retry. Early callbacks rearm
for the remaining time. Reveal waits for later owner progression; this issue
never opens the second snapshot question.

Retry the **same** `commandId` and `expectedRevision` after an acknowledgement
timeout. The receipt is checked before the current revision/phase guard, so an
accepted retry returns the current safe question state, including reveal after
the deadline, without opening again or resetting timing. One start receipt is
retained per room. Changed content with the accepted ID is a conflict; a new
command after opening is rejected. Concurrent starts serialize synchronously
through the single-process immutable room store.

New admissions (including lobby join retries) are rejected after opening with
`ROOM_CLOSED`; existing players retain their credentials. `state.sync`,
`session.restore`, and owner `host.bind` use the existing authority and subscribed
snapshot rules and include the current question fields while playing. The
full accepted-answer/recovery contract and its acceptance work remain #55–#56.
`lobby.roster` events remain display-only and do not replace a complete question
snapshot. Clients compare revisions across roster and question events and
request `state.sync` after missed updates.

Starting cancels the thirty-minute **idle lobby** expiry. Owner cancellation and
the existing 120-second host absence deadline remain active. The question can
reveal while the host is away. Room cancellation cancels its question timer,
erases the live aggregate/receipt, emits `lobby.closed`, and invalidates sessions.
Application shutdown cancels all scheduled callbacks. No durable live state or
cross-process ordering is provided.

| Error code | Meaning |
| --- | --- |
| `UNAUTHORIZED` | Missing, invalid, expired, or revoked account token |
| `FORBIDDEN` | Foreign owner or connection not bound as this room's host |
| `SESSION_REPLACED` | A newer host connection owns the room |
| `INVALID_PAYLOAD` | Invalid UUID, revision, or unexpected field |
| `EMPTY_LOBBY` | No joined players |
| `STALE_REVISION` | Unaccepted command targets an old room revision |
| `COMMAND_CONFLICT` | Accepted command ID reused with changed revision content |
| `WRONG_PHASE` | New start command after the lobby phase |
| `ROOM_CLOSED` | Terminal room or admission after opening |

Failures use `{ok:false,error:{code,message}}`. The existing closure reason is
included in the `ROOM_CLOSED` message when a retained terminal tombstone exists.
A retried `POST /rooms` creation receipt can now return `question_open` or
`question_reveal` metadata; OpenAPI documents these live phase values. It never
returns question content or an answer key.

## Real-client no-answer example

Create a hostable quiz through the [authoring walkthrough](quiz-authoring-walkthrough.md),
then `POST /rooms` with its `quizId`, a fresh request UUID, and the owner's bearer
token. Use the response as `room`, and the owner's login token as `token` below.
Run in a Node environment with `socket.io-client`; `API_URL` is your API origin.

```javascript
import { io } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
const open = async (auth = {}) => {
  const socket = io(API_URL, { transports: ['websocket'], auth, forceNew: true });
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
};
const ack = async (socket, event, payload) => {
  const result = await socket.timeout(3000).emitWithAck(event, payload);
  if (!result.ok) throw new Error(result.error.code);
  return result.data;
};
const host = await open({ token });
const alice = await open();
const bob = await open();
await ack(host, 'host.bind', { roomId: room.roomId });
await ack(alice, 'lobby.join', { pin: room.pin, nickname: 'Alice', requestId: randomUUID() });
await ack(bob, 'lobby.join', { pin: room.pin, nickname: 'Bob', requestId: randomUUID() });
const reveals = [host, alice, bob].map(socket => new Promise(resolve => {
  socket.once('question.revealed', resolve);
}));
const current = await ack(host, 'state.sync', { roomId: room.roomId });
const command = { roomId: room.roomId, commandId: randomUUID(), expectedRevision: current.revision };
const opened = await ack(host, 'host.start', command);
console.log(opened.phase, opened.deadline, opened.question.options);
// Submit no answers; server time alone closes the round.
console.log(await Promise.all(reveals)); // all show reveal and score 0
console.log(await ack(host, 'host.start', command)); // same deadline, current reveal
[host, alice, bob].forEach(socket => socket.disconnect());
```

Automated [real-client acceptance](../../test/lobby.gateway.e2e-spec.ts) uses
independent Socket.IO connections, real HTTP/JWT/PostgreSQL, and an injected room
clock to avoid sleeping for question duration. [Fake-time application tests](../../src/room/application/services/live-question.service.spec.ts)
cover exact cutoff/callback ordering, retries, safe projections, wall-clock jumps,
and cancellation. UI rendering, countdown estimation, storage, and stale-update
presentation belong to the separate UI repository. This document is its API
handoff; no UI repository URL is assumed.
