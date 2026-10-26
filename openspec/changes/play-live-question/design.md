# Design

## Context

Apply after add-game-lobby is archived. Reuse its room store, identity bindings, safe projections, and lifecycle timers. See specs/live-gameplay/spec.md. This change demonstrates the first round; progression and durable reports come next.

## Goals / Non-Goals

Repository boundary: this is an API-only change. The existing UI is an external consumer maintained in another repository. See [API/UI boundary](../../../docs/api-ui-boundary.md) for contract handoff and completion responsibilities.

Goals: deterministic timed state, one accepted answer, safe reveal, and reconnect across a round.
Non-goals: speed bonuses, early closure when everyone answers, pause, or distributed coordination.

## Decisions

1. Keep round state, transitions, accepted answers, and scoring together in the live-game domain/application boundary. Extend the existing room mutation queue; do not split scoring into a separately deployed service. Gateways only validate/bind identity and invoke use cases.
2. State transition is LOBBY → QUESTION_OPEN → QUESTION_REVEAL. Only start with at least one eligible player. Freeze roster and the first snapshot question on start. The scheduler closes at the deadline; the application also checks the authoritative clock on every submission so delayed callbacks cannot accept late answers. Use a monotonic clock for elapsed decisions and provide wall-clock serverNow/deadline fields for browser countdowns.
3. Add host.start {roomId,commandId,expectedRevision}, answer.submit {roomId,questionId,submissionId,optionId}, and the existing state.sync/restore. Mutations serialize per room. Bind the actor from the session; reject stale phase/question, unknown option, and mismatched room before mutation.
4. Cache accepted answer identity, payload fingerprint, acceptance time, and ack for the room lifetime. After credential and payload checks, look up an accepted retry before checking current phase/deadline. An identical retry gets its receipt even after reveal; different content or a second submission conflicts. Bound receipt count by one accepted submission per player/question.
5. Host command receipts are keyed by commandId and actor; look them up before expectedRevision checks for valid retries. Different reuse of an ID conflicts. All state commits increment revision. Errors have stable codes such as NOT_OWNER, WRONG_PHASE, LATE_ANSWER, INVALID_OPTION, ALREADY_ANSWERED, and SESSION_UNAVAILABLE.
6. Do not send correct-option flags to public host or guest question payloads before reveal. The private authoring API stays owner-only. Guest state includes only its own submission status and score. At deadline close once, award 1000 per correct accepted answer, then publish a reveal with correct option and safe feedback. Do not broadcast other guests' selected choices during the open round.
7. Supply serverNow/deadline with documented units and a consistent role-safe snapshot at a monotonically increasing room revision. Reject new answers for stale questions regardless of buffering; preserve accepted-retry receipts. The UI separately owns countdown estimation, stale-update handling, reconnection presentation, and control lockout. Test API snapshots, revisions, and acceptance decisions without requiring a browser.
8. The existing host absence timer continues through gameplay. Questions still close; reveal awaits owner return. Reauthenticate on restoration and private host commands. An expired JWT requires login again within the reconnect window, without extending it. At 120 seconds cancel and invalidate the room's answer authority.
9. Public question payloads carry stable option IDs and labels, phase, deadline, and actor-specific accepted-answer state; acknowledgements distinguish acceptance from correctness. Document these shapes for host/player consumers. Screens, colored buttons, keyboard behavior, and visible submission feedback are follow-ups in the separate UI repository.

## Risks / Trade-offs

- Packet loss → explicit acknowledgements, bounded retries, and state sync; automatic transport reconnect alone is insufficient.
- Simultaneous timeout/answer → per-room serialization plus clock cutoff; test exact T and either callback ordering with fake time.
- Score inflation on retries → scoring is a one-time state transition tested under repeated close events.
- Long host sessions can exceed JWT lifetime → return explicit auth errors and require validated owner identity on restoration; the UI owns reauthentication presentation.

## Migration Plan

No persistent migration. Extend existing room version safely in memory; cancel active rooms before deploying incompatible live-state changes. Implement start, submit, close, reveal, and reconnect one tested behavior at a time. Rollback disables start and cancels active rounds; saved quizzes are unaffected.

## Predecessor reconciliation — issue #54 (2026-10-26)

`add-game-lobby` was fully verified and archived as
`2026-10-26-add-game-lobby` before this implementation; re-read the resulting
main `game-lobby`, `quiz-authoring`, `user-auth`, and `jwt-guard` specifications.
The existing store serializes synchronous immutable mutations, rather than an
async queue. Reuse that atomic boundary. Host commands require current bound
connection authority plus fresh JWT validation. Keep bounded start receipt data
on the room, and preserve credential/current-connection rules.

Issue #54 implements tasks 1.1–1.4 and the no-answer deadline portion of 3.1.
The agreed issue contract authorizes these interfaces and one-behavior TDD
without a separate planning approval. Use `question_open` and `question_reveal`
wire phases, `question.opened` and `question.revealed` room events. A dedicated
question runtime port supplies monotonic milliseconds for decisions and Unix
milliseconds for countdown timestamps. Start cancels idle lobby expiry while
preserving host absence/cancellation. Store one accepted start command and
expected-revision fingerprint; retry reads current safe state without restarting.
Answer acceptance/nonzero scoring remain #55; full active recovery acceptance
remains #56. This change remains active until both follow-ups are verified.

## Answer acceptance reconciliation — issue #55 (2026-10-26)

Re-read the archived lobby predecessor and actual main `game-lobby`,
`quiz-authoring`, `user-auth`, and `jwt-guard` specifications. Issue #54 is
implemented on main (`1cdfce0`, documentation correction `b281e6b`); it leaves
this change active for #55 and #56. The agreed #55 contract supplies the
interface and behavior priorities for one-test/one-behavior TDD.

Extend `LIVE_QUESTION_PORT` with synchronous `submit`, taking the current
connection rather than a submitted player identity. Keep one frozen receipt per
eligible player in `LiveRound`; submission IDs are scoped to player/question.
Validate current session and question/option fields before retry lookup, then
check monotonic time for new answers. Stable additional errors are
`WRONG_QUESTION`, `INVALID_OPTION`, `SUBMISSION_CONFLICT`, `ALREADY_ANSWERED`, and
`LATE_ANSWER`. Accepted retries do not settle the reveal or alter their original
acceptance revision; state sync and the scheduled callback supply current state.

Reveal stores frozen per-player scores in the same once-only transition. Guest
snapshots and reveal events add only that guest's `acceptedAnswer` receipt/null
and score. Host/shared opening projections keep score zero and omit receipts.
The event port supplies current connection-specific views; the single-process
socket adapter excludes guests from the public reveal and emits their private
view only while still subscribed. Roster broadcasts select only display fields.
No new store, credentials, migration, or DI token is required. Full active-round
recovery/host-absence acceptance and final archival remain #56.
