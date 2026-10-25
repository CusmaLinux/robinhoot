# Design

## Context

Apply only after add-quiz-authoring is implemented and archived. Re-read its main specs and actual quiz read/validation contract. See specs/game-lobby/spec.md. Existing global auth/roles guards use HTTP request context, so socket behavior needs explicit transport handling.

## Goals / Non-Goals

Repository boundary: this is an API-only change. The existing UI is an external consumer maintained in another repository. See [API/UI boundary](../../../docs/api-ui-boundary.md) for contract handoff and completion responsibilities.

Goals: an isolated owned lobby with secure guest identity and clear admission feedback.
Non-goals: starting rounds, student accounts, durable live state, horizontal scaling, or Redis.

## Decisions

Predecessor review (2026-10-25, issue #50): #49 is merged in main at
`4487208`; `add-quiz-authoring` is archived as `2026-10-24-add-quiz-authoring`.
Re-read the resulting main quiz-authoring specification, owned read/save/delete
ports, readiness rules, HTTP contract, and archival evidence. Fresh predecessor
verification on the dedicated `robinhoot_issue50_test` database: 71 unit tests,
104 integration tests, four e2e tests, and build pass. Authoring read returns an
owned quiz with derived readiness or null; incomplete drafts remain valid saved
content. Room creation must reject incomplete content and copy the aggregate,
including stable identities and array order, without a quiz foreign key.
No predecessor contract change is needed.

Issue #50 contract decisions: `POST /rooms` requires UUID `quizId` and
`requestId`, normalized to lowercase. The successful receipt is one request ID
retained on the active room, scoped by authenticated owner. Same request/quiz
replays HTTP 201; reuse for another quiz is 409 `CREATION_REQUEST_CONFLICT`.
An owner with another active request receives 409 `OWNER_HAS_ACTIVE_ROOM`.
PIN allocation tries at most 32 candidates before 503
`PIN_ALLOCATION_EXHAUSTED`. All failures release the owner reservation. Internal
host binding is `{ownerId}` from the verified account; no host secret or quiz
content is returned. See the [implemented contract](../../../docs/contracts/room-creation.md)
and [current diagrams](../../../docs/architecture/room-creation.md). Socket host
authentication and lifecycle transitions remain in #51–#53; no socket event is
introduced by the creation slice.

Issue #51 contract review (2026-10-25): predecessor #50 merged at `fbb3aba`;
reviewed the actual frozen snapshot/store/HTTP contract and the current main
quiz-authoring, user-auth, and jwt-guard specs. The authoring archive remains
`2026-10-24-add-quiz-authoring`. Admission composes with those contracts without
changing ownership or HTTP authentication. See the
[implemented admission contract](../../../docs/contracts/lobby-admission.md) and
[current architecture](../../../docs/architecture/lobby-admission.md).

Issue #51 decisions: default namespace `/`, Socket.IO path `/socket.io`, and
`host.bind {roomId}` with handshake `auth.token` establish host subscriptions.
Only `lobby.join` is public; private gateway messages explicitly use the existing
JWT validator on every message and compare the verified account with host.ownerId.
`lobby.roster` publishes an explicit safe state projection. Guest credentials
have 256 random bits and a stored SHA-256 verifier bound to room/player.
Admission receipts are one per guest (at most thirty), bound to original
connection/request UUID/trimmed nickname; only that connection can recover the
secret after an acknowledgement timeout. Disconnect erases the receipt plaintext,
marks the guest offline, and retains its slot/verifier. This restriction avoids
making a request UUID a session takeover credential; credential-based reload
and replacement-connection behavior remain #52.

Join attempts are bounded before validation/lookup: ten per connection and sixty
per peer source address in fixed sixty-second windows; the source table is capped
at 10,000 and fails closed for new sources when full. Connection entries are
released on disconnect, source budgets survive reconnect storms, and expired
sources are reclaimed lazily. RoomModule's `ADMISSION_LIMITS` Symbol binding makes
the defaults configurable. Peer addresses are used without trusting caller
forwarded headers. These are pilot defaults to tune with evidence. No new public
lifecycle command is added here; the internal phase check rejects closed rooms,
while actual cancellation, expiry, and cleanup remain #53. `add-game-lobby`
remains active until #52–#53 and their handoff/verification are complete.

1. Add a live-game application boundary with RoomStore, QuizSnapshotReader, Clock, Scheduler, and CredentialIssuer ports as needed by tested behaviors. Use Symbol DI tokens and infrastructure adapters. Read an owned, validated quiz once when creating the room and deep-copy a versioned snapshot; do not re-read mutable quiz content during play.
2. Use a single-process in-memory room registry and per-room serialized mutations. Guard room creation per owner across any awaited quiz lookup to enforce one active room. Generate six-digit PINs including leading zeros with a collision check; retry boundedly and fail gracefully if allocation fails. Never overwrite an active PIN.
3. POST /rooms accepts quizId under account authentication and returns owner-safe room metadata and PIN. Use request IDs for retriable room creation; retain a bounded creation receipt while the room exists so a lost acknowledgement does not cause a second room. Invalid quiz returns 400; foreign quiz returns 404; another active room returns 409.
4. Add NestJS Socket.IO gateway adapters with public guest admission and explicit authenticated host commands. Install compatible @nestjs/websockets, @nestjs/platform-socket.io, and socket.io using pnpm; socket.io-client can be a development dependency for API transport tests. The separate UI owns its runtime client dependency. Ensure global HTTP guards handle gateway contexts intentionally; do not globally bypass authentication on private host messages.
5. Initial client events: lobby.join {pin,nickname,requestId}, session.restore {roomId,credential}, state.sync {roomId}, and host.cancel {roomId,commandId}. Host connects with account auth and an explicit host-room binding. Success ack is {ok:true,data}; failures are {ok:false,error:{code,message,fields?}}. Safe state broadcasts carry roomId, revision, phase, roster display identity and connection state; no guest credentials or quiz answer keys.
6. Generate cryptographically random guest credentials, store a verifier bound to the room/player, and return credentials only in the joining/restoring actor's private response. The UI owns storage and resubmission of the credential; the API contract specifies its room scope and lifetime. Reuse the same join requestId after an ack timeout; a bounded admission receipt permits issuing the same session response to that request without creating a second player. A new request with a duplicate nickname is rejected. Rebinding invalidates the previous socket's authority. Never authenticate by socket.id, nickname, or payload playerId.
7. Admit at most thirty players, with normalized trimmed nickname uniqueness. Count disconnected joined players toward the limit so reconnect retains a slot. No manual kick/leave/reclaim is in this MVP. Rate-limit joins per connection and source address, including reconnect storms; start with bounded configurable limits and tune with pilot evidence.
8. Every room mutation increments revision. Subscribe and capture a current snapshot in one serialized operation so reconnect cannot miss an update between sync and subscription. Timer callbacks carry room identity and cannot mutate a replacement room.
9. Lobby expires thirty minutes after creation; reconnect does not extend it. Host absence cancellation runs after 120 seconds; cancel its scheduled action when the owner returns. Cancellation invalidates credentials and clears timers/receipts. Keep a short bounded closure tombstone for meaningful reconnect errors. Publish the join/restore/roster/closure event contract for the separate UI; no browser routes or screens are implemented here.

## Risks / Trade-offs

- Process restart destroys rooms → report session-unavailable; durable live recovery is deferred.
- Guessable PINs → PIN grants admission only, never host authority; rate-limit admission and avoid credential logging.
- Cached join receipts hold secrets temporarily → bound memory/lifetime, use unguessable request IDs, and clear on room cleanup.
- Socket and HTTP guard mismatch → integration-test both transports and preserve all existing private HTTP behavior.

## Migration Plan

No room database migration is needed. Add gateway dependencies and adapters after a tested room-creation slice, then build guest admission/reconnect and lifecycle slices. Verify with real Socket.IO test clients and deliver event/ack/error examples to the UI maintainer. Roll out behind room creation availability; rollback cancels lobbies with reasons and disables the gateway. Keep quiz endpoints usable.

## References

- [NestJS gateways](https://docs.nestjs.com/websockets/gateways)
- [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/)
