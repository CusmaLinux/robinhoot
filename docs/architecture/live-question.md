# Live-question and progression architecture

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
Start selects the first immutable snapshot question; next selects its immediate successor at reveal.

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
  Live-->>Guests: question.opened, A–D or True/False labels, no correctness
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
reveal. Answer acceptance never includes correctness. The [active recovery acceptance record](../contracts/active-game-recovery.md)
verifies this boundary through real clients. See [progression and cancellation](../contracts/game-progression.md) for the multi-question contract. See the [durable finalization contract](../contracts/game-finalization.md) for completion.

## Active recovery and host absence

Both host and guest question snapshots settle lifecycle deadlines, including
while already at reveal. A delayed host-timeout callback cannot let a public
host snapshot bypass cancellation. A closed snapshot fails with `ROOM_CLOSED`
and the retained reason instead of returning stale reveal or lobby data.
The gateway completes subscription, rechecks the actor, then synchronously
combines display roster and the current question projection. A read can settle
a delayed reveal before returning its newer revision and fixed scores.

```mermaid
sequenceDiagram
  participant Guest
  participant Gateway
  participant Auth as JWT validator
  participant Lifecycle
  participant Live
  participant Host
  Host->>Gateway: Disconnect
  Gateway->>Lifecycle: Start fixed 120-second absence window
  Guest->>Gateway: session.restore(roomId, credential)
  Gateway->>Gateway: Restore identity and complete subscription
  Gateway->>Live: Project current question for current guest connection
  Live->>Lifecycle: Enforce room cancellation deadline
  Live-->>Guest: Current revision, deadline, own receipt and score
  Live->>Live: Question deadline closes and scores once while host absent
  Host->>Gateway: host.bind using expired JWT
  Gateway->>Auth: Validate again
  Auth-->>Host: UNAUTHORIZED, absence deadline unchanged
  Host->>Gateway: host.bind after owner login within 120 seconds
  Gateway->>Auth: Validate current owner JWT
  Gateway->>Lifecycle: Restore host authority and cancel absence timer
  Gateway->>Live: Read current public reveal after subscription
  Live-->>Host: Current revision and reveal without guest receipts
```

Host absence changes connection authority rather than question phase. Open
still transitions to reveal at the original deadline, and reveal remains until
owner-controlled progression. Successful owner return before
the cutoff cancels absence without reopening or rescoring. Failed authentication
or foreign ownership cannot cancel or extend it. At the cutoff, cancellation
wins even if its callback is delayed; receipts and guest credentials lose their
authority with the room. A later disconnect begins a new absence window only for
the then-current bound host.

## Ordered progression and early ending

`host.next` uses the existing live-question port, current host authority, and
UUID/revision validation. Accepted command lookup precedes phase/revision checks
and distinguishes start from next. Prior revealed rounds remain frozen inside
the room, bounded by the snapshot's twenty-question limit. Each holds its
opening command fingerprint, eligible roster, accepted answers and fixed
scores. The current round begins with empty answers/scores and fresh wall and
monotonic deadlines. Guest totals sum revealed rounds; public opening scores
remain zero. Historical accepted-answer retries preserve their original receipt.
No new persistence, DI provider, or external service is needed.

```mermaid
sequenceDiagram
  participant Host
  participant Gateway
  participant Live
  participant Lifecycle
  participant Store
  participant Timer
  participant Guests
  Host->>Gateway: host.next(roomId, commandId, expectedRevision)
  Gateway->>Gateway: Validate payload and fresh JWT/current binding
  Gateway->>Live: Next using verified owner/connection
  Live->>Live: Check authority, accepted receipt, reveal, remaining question, revision
  Live->>Store: Retain revealed round and open next snapshot with fresh deadline
  Live->>Timer: Schedule next monotonic cutoff
  Live-->>Host: Public acknowledgement and question.opened
  Live-->>Guests: Public question.opened without correctness
  Host->>Gateway: Retry same next command after acknowledgement loss
  Gateway->>Live: Check original command fingerprint
  Live-->>Host: Current public state without advancing or resetting
  Host->>Gateway: host.cancel(roomId, commandId)
  Gateway->>Lifecycle: Cancel using verified owner/connection
  Lifecycle->>Store: Remove room and release indexes/timers
  Lifecycle-->>Host: lobby.closed with OWNER_CANCELLED
  Lifecycle-->>Guests: lobby.closed with OWNER_CANCELLED
```

```mermaid
stateDiagram-v2
  QuestionOpen --> QuestionReveal: Deadline scores current question once
  QuestionReveal --> QuestionOpen: Owner next with remaining snapshot question
  QuestionReveal --> QuestionReveal: Accepted retry or rejected next after final question
  QuestionOpen --> QuestionOpen: Accepted retry preserves current deadline
  QuestionOpen --> Closed: Owner cancellation or host timeout
  QuestionReveal --> Closed: Owner cancellation or host timeout
  Closed --> [*]: Live rounds removed, bounded closure tombstone retained
```

Cancellation reuses `LobbyLifecyclePort` and `lobby.closed`; both later open and
reveal close with a reason and invalidate all command/answer authority. Cancelled games produce no completion. Issue #58 adds durable finalization
below; [owned history and finished-room cleanup](../contracts/report-history.md) complete #59. The predecessor main `live-gameplay` spec
was synced and its fully verified change archived before this extension.

## Durable finalization

`FINISH_GAME_PORT` routes the JWT-validated bound owner to `FinishGameService`.
The service validates the final reveal and revision, captures one deeply frozen
report candidate, and marks finalization synchronously before awaiting
`REPORT_REPOSITORY_PORT`. Concurrent valid commands share a pending promise.
The Kysely adapter uses a transaction, unique room primary key, conflict-ignore
insert, and owner-filtered read of the original document. No live credential or
answer receipt enters the durable payload. The domain report builder imports
only domain types and produces deterministic totals, shared ranks and counts.
`RoomModule` binds both ports and `GAME_EVENTS_PORT` to concrete adapters.

During persistence, `LobbyLifecycleService` suppresses host-absence settlement
and cancellation while synchronization still returns reveal plus `finalizing`.
Failure retains the candidate, clears the flag and reevaluates/rearms absence.
Success installs the stored report, advances revision once, disarms absence and
only then calls `GameEventsPort.finished`. The Socket.IO adapter broadcasts
`game.finished` to the subscribed room channel. Synchronization/restoration use
the same finished report; a lost event can be recovered without another write.
Terminal answers/progression/cancellation are rejected. No callback can close
an in-flight or finished room. Finished-room retention is handled separately below.

```mermaid
flowchart LR
  Host --> Gateway[LobbyGateway]
  Gateway --> Finish[FinishGamePort / service]
  Finish --> Builder[Domain report facts]
  Finish --> Store[RoomStorePort]
  Finish --> Lifecycle[LobbyLifecyclePort]
  Finish --> Repository[ReportRepositoryPort]
  Repository --> Adapter[ReportKyselyAdapter]
  Adapter --> PostgreSQL[(Unique room report)]
  Finish --> Events[GameEventsPort]
  Events --> Socket[SocketLobbyEvents]
  Socket --> Participants[Subscribed host and guests]
```

```mermaid
sequenceDiagram
  participant Host
  participant Gateway
  participant Finish as FinishGameService
  participant Lifecycle
  participant Reports as PostgreSQL report adapter
  participant Guests
  Host->>Gateway: host.finish(roomId, commandId, expectedRevision)
  Gateway->>Gateway: Revalidate JWT, payload and host binding
  Gateway->>Finish: Finalize as verified owner and connection
  Finish->>Lifecycle: Check authority and freeze finalization
  Finish->>Finish: Capture immutable candidate from last reveal
  Finish->>Reports: Transactional saveOnce by room UUID
  Note over Lifecycle: Keep reveal; suppress timeout cancellation
  alt Storage commits
    Reports-->>Finish: Original stored owned report
    Finish->>Finish: Commit finished and increment revision once
    Finish->>Lifecycle: Disarm cancellation timers
    Finish-->>Host: game.finished and successful acknowledgement
    Finish-->>Guests: game.finished
  else Storage fails or response is lost
    Reports-->>Finish: Persistence error
    Finish->>Lifecycle: Clear finalizing; settle or rearm absence
    Finish-->>Host: REPORT_SAVE_FAILED, retryable true
    Host->>Gateway: Retry original finish command
    Gateway->>Finish: Retry after fresh authorization
    Finish->>Reports: saveOnce with same frozen candidate
    Reports-->>Finish: Same original report if already stored
  end
```

```mermaid
stateDiagram-v2
  QuestionReveal --> Finalizing: Owner finish at last reveal
  state "Reveal with finalizing true" as Finalizing
  Finalizing --> Finalizing: Concurrent finish shares write
  Finalizing --> Finished: Report transaction committed
  Finalizing --> QuestionReveal: Save failed, no expired host absence
  Finalizing --> Closed: Save failed with expired host absence
  QuestionReveal --> Closed: Owner cancels before finalization
  Finished --> Finished: Finish retry or current-session sync
```

## Owned history and finished-room retention

`ReportController` uses the global account JWT guard and `CurrentUser` identity,
then invokes `READ_REPORTS_PORT`. `ReadReportsService` depends only on
`REPORT_HISTORY_PORT`; its Kysely adapter filters both list and read by actual
owner ID. Foreign UUIDs and missing UUIDs map to the same HTTP 404, including
for admins. Reads use stored JSONB documents without consulting source quizzes
or live rooms. `RoomModule` shares one report adapter through Symbol bindings;
report DTOs document the versioned snapshot independently of editable quiz DTOs.

```mermaid
flowchart LR
  Owner[Authenticated professor] --> HTTP[ReportController]
  HTTP --> Read[ReadReportsPort / service]
  Read --> History[ReportHistoryPort]
  History --> Adapter[ReportKyselyAdapter]
  Adapter --> DB[(Owned immutable PostgreSQL documents)]
```

```mermaid
sequenceDiagram
  participant Owner
  participant HTTP as ReportController
  participant Read as ReadReportsService
  participant DB as ReportKyselyAdapter / PostgreSQL
  participant Timer as Lobby lifecycle scheduler
  participant Rooms as Process-local room store
  Owner->>HTTP: GET /reports with account JWT
  HTTP->>Read: List using verified owner ID
  Read->>DB: Owner-filtered documents, newest first
  DB-->>Owner: Stored reports
  Timer->>Rooms: Ten minutes after successful finish: remove live aggregate and indexes
  Note over Rooms: Credentials, receipts and timers expire; no cancellation
  Owner->>HTTP: GET /reports/:id after cleanup, source deletion or restart
  HTTP->>Read: Read using verified owner ID and validated UUID
  Read->>DB: Match owner ID and room/report UUID
  DB-->>Owner: Original report or indistinguishable 404 for missing/foreign
```

```mermaid
stateDiagram-v2
  Finished --> Finished: Session sync or finish retry within ten minutes
  Finished --> LiveExpired: Fixed ten-minute deadline or backend restart
  LiveExpired --> [*]: Room credentials, receipts, owner/PIN indexes and timers released
  state "Durable owned report remains readable" as Report
  Report --> Report: Source edit/deletion, live cleanup or backend restart
```

`completeFinalization` cancels play/absence timers and schedules one fixed
retention deadline. `settle` handles finished retention before cancellation logic;
checked reads enforce it even if timer delivery is delayed. Host rebind cannot
extend it. UUID/entry checks isolate stale callbacks from replacement rooms.
Cleanup removes the live aggregate and active lifecycle entry without publishing
`lobby.closed`, creating a closure tombstone or touching the durable repository.

## Mixed question formats

[True/False](../contracts/true-false.md) changes only the safe option-label
projection in the live service: truth labels are their fixed text, while
multiple-choice labels remain positional A–D. The same engine, command ports,
monotonic scheduler, receipts and state/sequence transitions above handle both
formats. There is no extra timing or scoring branch. Fixed truth IDs repeat
across questions; the existing question ID check scopes accepted submissions.

QuizSnapshot version 2 identifies mixed/truth content; the domain report builder
copies the snapshot's version. Freeze/copy behavior preserves type and choices
after source edits. Both report versions use the same immutable JSONB adapter
and owner-filtered history ports. There is no new migration or runtime provider.
