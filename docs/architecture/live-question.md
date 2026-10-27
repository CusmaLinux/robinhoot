# Timed first-question architecture

The [wire contract](../contracts/live-question.md) defines start, safe opening,
server timing, private answer receipts, retries, and scored reveal. This extends the
[lobby boundary](lobby-admission.md) after its completed OpenSpec archive.

`LobbyGateway` validates `host.start`, reuses the per-message JWT guard, checks
its actor binding, and invokes the `LIVE_QUESTION_PORT`. `LiveQuestionService`
checks current host authority through `LOBBY_LIFECYCLE_PORT`. All round mutations
are synchronous through `ROOM_STORE_PORT`; no awaited work can interleave a
phase/revision check and its commit. The existing in-memory store freezes each
replacement room; round eligibility and the accepted start receipt are frozen
inside it. Accepted answers and reveal scores are also frozen inside that round.
Only the first immutable quiz snapshot question is selected.

`answer.submit` accepts only room/question/submission/option UUIDs. The gateway
requires a bound guest, while the application derives player identity from the
current connection in the room aggregate. It validates question, option, and
eligibility, then checks the player's accepted receipt before deadline/phase.
An identical retry copies the original receipt; changed reused IDs and second
submissions conflict. The monotonic clock guards new answers independently of
timer delivery. Acceptance increments revision once, preserves the deadline,
and publishes no choice or correctness to other participants.

Reveal computes and stores each eligible player's 1000-or-zero points in the
same atomic phase/revision transition. Subsequent close callbacks see reveal and
cannot score again. The event port carries a public host state plus projections
for current guest connections. The socket adapter excludes those guests from
the public reveal and sends each subscribed guest only their own receipt/score.
Sync/restoration project the same private state after authority revalidation.
Roster publication explicitly selects display fields so restoration cannot
broadcast a private receipt.

`QUESTION_RUNTIME_PORT` isolates the monotonic decision clock, wall timestamps,
and cancellable scheduler. `SystemQuestionRuntime` uses Node's monotonic
performance clock and unreferenced timers. `QUESTION_EVENTS_PORT` isolates safe
opening/reveal publication; `SocketLobbyEvents` implements this and the existing
closure port. Symbol bindings live in `RoomModule`. Domain code imports no Nest,
Socket.IO, crypto, or timer implementations.

```mermaid
flowchart LR
  Clients[Host and guest clients] --> Gateway[LobbyGateway]
  Gateway --> Live[LiveQuestionPort / service]
  Live --> Store[RoomStorePort]
  Live --> Lifecycle[LobbyLifecyclePort]
  Live --> Runtime[QuestionRuntimePort]
  Live --> Events[QuestionEventsPort]
  Events --> Socket[SocketLobbyEvents]
  Socket --> Clients
```

```mermaid
sequenceDiagram
  participant Host
  participant Gateway
  participant Auth as JWT validator
  participant Live as LiveQuestionService
  participant Store
  participant Timer as Monotonic scheduler
  participant Guests
  Host->>Gateway: host.start(roomId, commandId, expectedRevision)
  Gateway->>Auth: Revalidate account token
  Gateway->>Live: Start using bound owner and connection
  Live->>Live: Check owner/current host, retry receipt, phase, roster, revision
  Live->>Store: Freeze eligible players, receipt and fixed deadline and increment revision
  Live->>Live: Cancel idle lobby expiry and retain host absence policy
  Live->>Timer: Schedule one authoritative deadline
  Live-->>Host: Safe acknowledgement and question.opened
  Live-->>Guests: question.opened, labels A–D, no correctness
  Guests->>Gateway: answer.submit(roomId, questionId, submissionId, optionId)
  Gateway->>Live: Submit using current bound connection
  Live->>Live: Validate identity and payload, check receipt, then deadline
  Live->>Store: Freeze one answer receipt and increment revision
  Live-->>Guests: Private acceptance acknowledgement, no correctness
  Guests->>Gateway: Identical accepted retry, including after reveal
  Gateway->>Live: Submit using current bound connection
  Live-->>Guests: Original acceptance receipt
  Timer->>Live: Deadline callback
  Live->>Live: Check room still active and monotonic cutoff
  Live->>Store: Reveal and store fixed player scores exactly once and increment revision
  Live-->>Host: question.revealed, correct option, public score zero
  Live-->>Guests: Private question.revealed, correct option, own receipt and score
```

```mermaid
stateDiagram-v2
  [*] --> Lobby: Owned room creation
  Lobby --> QuestionOpen: Current owner starts with joined players
  Lobby --> Closed: Idle expiry, host timeout, or owner cancellation
  QuestionOpen --> QuestionOpen: Accepted start retry preserves deadline
  QuestionOpen --> QuestionOpen: Accept one private answer, keep deadline
  QuestionOpen --> QuestionOpen: Identical answer retry returns original receipt
  QuestionOpen --> QuestionReveal: Monotonic deadline and fixed scoring once
  QuestionReveal --> QuestionReveal: Start retry returns reveal, answer retry returns original receipt
  QuestionOpen --> Closed: Owner cancellation or host timeout
  QuestionReveal --> Closed: Owner cancellation or host timeout
  Closed --> [*]: Live state removed and bounded closure tombstone retained
```

A state read can settle a delayed reveal callback before projecting its current
revision. Early timer callbacks rearm for the remaining monotonic interval;
repeated callbacks see reveal and cannot award points or publish twice. Wall-clock
jumps change public `serverNow` without changing elapsed decisions. Cancellation
and shutdown release timers. Stale callbacks carry the original room UUID and
cannot affect another room, even if its owner/PIN is reused.

Subscription completes before authority revalidation and question projection;
start/reveal during a delayed subscription is therefore reflected in the
acknowledgement. Roster events carry only display state. Complete question
snapshots use explicit public fields; correct options are projected only at
reveal. Answer acceptance never includes correctness. Full recovery acceptance
(#56), progression, and durable reporting remain later slices. The live-question OpenSpec change stays active.
