# Design

## Context

Apply only after add-quiz-authoring is implemented and archived. Re-read its main specs and actual quiz read/validation contract. See specs/game-lobby/spec.md. Existing global auth/roles guards use HTTP request context, so socket behavior needs explicit transport handling.

## Goals / Non-Goals

Repository boundary: this is an API-only change. The existing UI is an external consumer maintained in another repository. See [API/UI boundary](../../../docs/api-ui-boundary.md) for contract handoff and completion responsibilities.

Goals: an isolated owned lobby with secure guest identity and clear admission feedback.
Non-goals: starting rounds, student accounts, durable live state, horizontal scaling, or Redis.

## Decisions

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
