# Timed first question — API/UI contract

Issues [#54](https://github.com/CusmaLinux/robinhoot/issues/54) and
[#55](https://github.com/CusmaLinux/robinhoot/issues/55) add a timed round with
private answer acceptance and fixed scoring. Use the existing HTTP room creation and Socket.IO default namespace at
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
      { "id": "option-a-uuid", "label": "A", "text": "First" },
      { "id": "option-b-uuid", "label": "B", "text": "Second" },
      { "id": "option-c-uuid", "label": "C", "text": "Third" },
      { "id": "option-d-uuid", "label": "D", "text": "Fourth" }
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
owner identity, and internal monotonic clock values. Opening and host views use
`score:0`. Guest sync/restore and personalized reveal carry only that player's
score and `acceptedAnswer` (a receipt, or `null` when unanswered). Public roster snapshots retain only display identity and
connection status. No other player's private submission data is exposed.

## Submit one answer

After admission or credential restoration, send `answer.submit` on the current
bound guest socket. No account JWT is required for this guest event. Payload:

```json
{
  "roomId": "ac8c4643-7df3-49f1-8718-d3ccfa37bc43",
  "questionId": "b7b806fd-28b0-4328-8408-904f63cf4ce9",
  "submissionId": "e1ce86da-2ba9-4612-874a-eaa99352c1fb",
  "optionId": "2de2f02d-0669-4ca3-8e10-fc0ac955de99"
}
```

All four fields must be UUID strings and are normalized to lowercase. Extra
fields, including `playerId` or `credential`, are rejected. Identity comes from
the server's current room/connection binding; a replaced socket cannot submit
or replay a receipt. Room, current question, option membership, and frozen
eligibility are checked before acceptance. New answers require monotonic time
strictly before the fixed deadline. At or after that instant they fail with
`LATE_ANSWER`, even while the close callback is delayed.

A successful acknowledgement confirms **acceptance**, never correctness:

```json
{
  "ok": true,
  "data": {
    "roomId": "ac8c4643-7df3-49f1-8718-d3ccfa37bc43",
    "questionId": "b7b806fd-28b0-4328-8408-904f63cf4ce9",
    "submissionId": "e1ce86da-2ba9-4612-874a-eaa99352c1fb",
    "optionId": "2de2f02d-0669-4ca3-8e10-fc0ac955de99",
    "accepted": true,
    "acceptedAt": 1793034000500,
    "revision": 4
  }
}
```

`acceptedAt` is Unix milliseconds; `revision` is the acceptance revision. Store
and resend the entire original payload after an acknowledgement timeout. After
current session and payload validation, the server looks up an accepted receipt
before applying phase/deadline checks. An identical accepted retry returns the
original receipt, including its timestamp/revision, before or after reveal. It
does not increment revision or award points. This older receipt revision is
acceptance evidence, not a replacement for the latest room snapshot.

One receipt is retained per player/question for the room lifetime. Submission
IDs are scoped to that player/question: changed content with an accepted ID
returns `SUBMISSION_CONFLICT`; a new ID from an already answered player returns
`ALREADY_ANSWERED`, even after reveal. Invalid question/option fields are rejected
before receipt lookup. A rejected submission creates no receipt and does not
mutate the round. A typical rejection is:

```json
{
  "ok": false,
  "error": { "code": "LATE_ANSWER", "message": "Question deadline has passed" }
}
```

`state.sync` and `session.restore` return the receiving guest's `acceptedAnswer`
receipt (or `null`), with the cumulative total from earlier reveals while open
(zero on the first question). This recovers lost acceptance
acknowledgements without disclosing correctness. The existing restoration
credential is required only by `session.restore`; it is never an answer field.
Other guests and the host receive no private choices or receipts. Roster
broadcasts contain only room ID, phase, revision, and display roster fields.

## Reveal and retries

At the deadline the room broadcasts `question.revealed` with the same shape,
`phase:"question_reveal"`, one additional revision, and
`correctOptionIds:["option-b-uuid"]`. `deadline` and `openedAt` are unchanged;
`serverNow` reflects the current server wall clock. The atomic reveal transition
stores 1000 points for each correct accepted answer and zero for wrong or missing
answers. Every connected guest receives their own `score` and `acceptedAnswer`;
the host receives the public projection with score zero and no receipt. Neither
all-answered nor retries shorten the timer. Offline players retain their result
for restoration.
Repeated or stale callbacks cannot reveal again. A delayed callback is also
settled by a current state read or accepted start retry. Early callbacks rearm
for the remaining time. Reveal waits for owner progression. `host.start` opens only the first snapshot
question; [host.next](game-progression.md) opens later questions.

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
snapshot rules and include the current question fields while playing. See the [active recovery rehearsal](active-game-recovery.md) for open/reveal
restoration, owner reauthentication, cancellation, and exact error transcripts.
`lobby.roster` events remain display-only and do not replace a complete question
snapshot. Clients compare revisions across roster and question events and
request `state.sync` after missed updates.

Starting cancels the thirty-minute **idle lobby** expiry. Owner cancellation and
the existing 120-second host absence deadline remain active. The question can
reveal while the host is away. Room cancellation cancels its question timer,
erases the live aggregate/receipt, emits `lobby.closed`, and invalidates sessions.
Application shutdown cancels all scheduled callbacks. No durable live state or
cross-process ordering is provided.

| Error code            | Meaning                                                      |
| --------------------- | ------------------------------------------------------------ |
| `UNAUTHORIZED`        | Missing, invalid, expired, or revoked account token          |
| `FORBIDDEN`           | Foreign owner, wrong room/role binding, or ineligible player |
| `SESSION_REPLACED`    | Connection no longer controls the host or guest identity     |
| `INVALID_PAYLOAD`     | Invalid UUID, revision, or unexpected field                  |
| `EMPTY_LOBBY`         | No joined players                                            |
| `STALE_REVISION`      | Unaccepted command targets an old room revision              |
| `COMMAND_CONFLICT`    | Accepted command ID reused with changed revision content     |
| `WRONG_PHASE`         | Invalid start phase or no open question for a new answer     |
| `WRONG_QUESTION`      | Submission targets a different question                      |
| `INVALID_OPTION`      | Option does not belong to the current question               |
| `LATE_ANSWER`         | New submission at or after the monotonic deadline            |
| `SUBMISSION_CONFLICT` | Accepted submission ID reused with changed option            |
| `ALREADY_ANSWERED`    | Another submission ID after this player already answered     |
| `ROOM_CLOSED`         | Terminal room or admission after opening                     |

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
  const socket = io(API_URL, {
    transports: ['websocket'],
    auth,
    forceNew: true,
  });
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
const aliceAdmission = await ack(alice, 'lobby.join', {
  pin: room.pin,
  nickname: 'Alice',
  requestId: randomUUID(),
});
await ack(bob, 'lobby.join', {
  pin: room.pin,
  nickname: 'Bob',
  requestId: randomUUID(),
});
const reveals = [host, alice, bob].map(
  (socket) =>
    new Promise((resolve) => {
      socket.once('question.revealed', resolve);
    }),
);
const current = await ack(host, 'state.sync', { roomId: room.roomId });
const command = {
  roomId: room.roomId,
  commandId: randomUUID(),
  expectedRevision: current.revision,
};
const opened = await ack(host, 'host.start', command);
console.log(opened.phase, opened.deadline, opened.question.options);
// Submit no answers; server time alone closes the round.
console.log(await Promise.all(reveals)); // all show reveal and score 0
console.log(await ack(host, 'host.start', command)); // same deadline, current reveal
[host, alice, bob].forEach((socket) => socket.disconnect());
```

## Lost answer acknowledgement example

Using the setup helpers above, use this flow after opening a fresh round
in place of the no-answer wait and disconnect section. Option 0 is a player's choice; the
public opening payload does not identify the correct option.

```javascript
const answer = {
  roomId: room.roomId,
  questionId: opened.questionId,
  submissionId: randomUUID(),
  optionId: opened.question.options[0].id,
};
// Simulate lost acknowledgement by omitting the callback.
alice.emit('answer.submit', answer);
const synchronized = await ack(alice, 'state.sync', { roomId: room.roomId });
console.log(synchronized.acceptedAnswer); // accepted receipt, no correctness
alice.disconnect();
const restoredAlice = await open();
const restored = await ack(restoredAlice, 'session.restore', {
  roomId: room.roomId,
  credential: aliceAdmission.credential,
});
console.log(restored.state.acceptedAnswer); // same receipt
// After question.revealed (or sync once the deadline passes):
const receipt = await ack(restoredAlice, 'answer.submit', answer);
const latest = await ack(restoredAlice, 'state.sync', { roomId: room.roomId });
console.log(receipt, latest.score, latest.correctOptionIds);
// Same receipt after reveal; score is 1000 for correct, otherwise 0.
```

Automated [real-client acceptance](../../test/lobby.gateway.e2e-spec.ts) uses
independent Socket.IO connections, real HTTP/JWT/PostgreSQL, and an injected room
clock to avoid sleeping for question duration. [Fake-time application tests](../../src/room/application/services/live-question.service.spec.ts)
cover exact cutoff/callback ordering, conflicts, once-only scoring, all-answered
timing, safe projections, wall-clock jumps, and cancellation. Real-client tests
also cover lost acknowledgements, reconnect/retry, simultaneous submissions,
forged identities, invalid payloads, and private per-player reveals. UI rendering, countdown estimation, storage, and stale-update
presentation belong to the separate UI repository. This document is its API
handoff; no UI repository URL is assumed.

For ordered later questions, cumulative scores, retained old-question receipts,
and early ending, see [question progression](game-progression.md).

## Optional image metadata

See [question images](question-images.md) for optional `imageUrl` /
`imageDescription`, syntactic HTTPS validation, safe projections, immutable
reference snapshots, compatibility and the API/UI handoff. The API never fetches images.
