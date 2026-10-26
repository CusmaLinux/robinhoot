# Tasks

Work one tested behavior at a time: failing test, minimal implementation, then refactor. All boxes are intentionally pending; planning does not complete implementation.

## 1. Predecessor and owned room creation

- [x] 1.1 Verify add-quiz-authoring is implemented and archived and re-read main specs/quiz APIs; update this change if its assumptions differ, recording the contract review.
- [x] 1.2 Test one owned room-creation behavior then implement a versioned quiz snapshot and in-memory room port/adapter; verify edits/deletion of the source do not mutate the room.
- [x] 1.3 Test invalid/foreign quiz creation, owner concurrency, PIN collision, and retried creation one behavior at a time; verify no duplicate room or PIN overwrite and document POST /rooms.
- [x] 1.4 Document and test the create-room response and private host binding; verify HTTP creation returns a room ID/PIN for an owned hostable quiz without leaking answer keys.

Issue #50 evidence (2026-10-25): predecessor #49 merged at `4487208` and
`2026-10-24-add-quiz-authoring` archival/main specification were reviewed before
application. Fresh predecessor checks passed (71 unit, 104 integration, four e2e,
build). Creation, deep freezing, incomplete readiness, foreign ownership,
active-owner exclusion, delayed concurrent reads, successful request replay,
request-ID conflict, PIN collision, and OpenAPI publication were exercised in
red/green slices. See the [HTTP/PostgreSQL suite](../../../test/room.controller.spec.ts),
[deterministic registry suite](../../../src/room/infrastructure/adapters/out/in-memory-room.store.spec.ts),
[contract handoff](../../../docs/contracts/room-creation.md), and
[component/sequence/state diagrams](../../../docs/architecture/room-creation.md).
HTTP checks include snapshot retention after edits/reorder/delete, safe output,
private authenticated host binding, user/admin ownership denial, malformed UUIDs
and ownership injection, missing/invalid/expired/revoked credentials, retries
after source deletion, and simultaneous same/distinct requests. Concurrent HTTP
fixtures commit through an independent app/pool and are explicitly cleaned up.
Registry checks include defensive copying, 32-collision exhaustion without PIN
overwrite, independent owners, and recovery after failed/pending lookups.

Verification uses the isolated PostgreSQL 17 container `robinhoot-issue50-test`,
database `robinhoot_issue50_test`, loopback port 55450, test-only credentials, and
the four existing migrations. Unit: 81 tests / 16 suites. Integration: 128 tests /
four suites, including 24 room HTTP behaviors. E2E: four tests. Build, TypeScript,
scoped ESLint, strict OpenSpec validation, and whitespace checks pass. Full
read-only lint has no errors and only the two pre-existing auth guard test
warnings. Advisory Fallow audit passes with no introduced findings; its automatic
boundary detector is not configured, so architecture direction was reviewed
manually. No schema migration, production database access, UI implementation, or
external maintainer message. Tasks 2–3 remain pending under #51–#53, and the lobby
change remains active until those API slices and their contract handoffs pass.

## 2. Guest admission and safe roster

- [x] 2.1 Add compatible Nest/Socket.IO dependencies with pnpm and explicit transport authentication; verify private HTTP endpoints stay protected and private host messages reject unauthenticated/foreign users.
- [x] 2.2 Test guest join then implement join acknowledgement, nickname validation, thirty-player admission, and safe roster broadcasts; verify one host and two guests share an isolated lobby.
- [x] 2.3 Test duplicate join request retries, duplicate nicknames, invalid PINs, full rooms, and admission throttling one at a time; verify clear errors and unchanged slot counts.
- [x] 2.4 Document join/acknowledgement/roster event examples and test them with independent Socket.IO clients; verify explicit connection/session data and no other players' credentials or correct-answer metadata in public payloads.

Issue #51 evidence (2026-10-25): #50 is merged at `fbb3aba`; re-read the
current room creation/snapshot/store contract, archived authoring predecessor,
and main quiz-authoring, user-auth, and jwt-guard specs. No predecessor contract
change was needed. Implemented `lobby.join`, authenticated `host.bind`, private
acknowledgements, room-only safe roster snapshots, offline guest state, bounded
connection/source attempts, and one connection/actor/room binding. Admission
and limiter behaviors were developed in failing-test/minimal-implementation
slices, followed by real Nest/Socket.IO/PostgreSQL acceptance verification.

Verification: 95 unit tests / 18 suites; 128 integration tests / four suites;
29 e2e tests / two suites (25 real transport admission behaviors and four
existing auth/roles checks). Database-backed checks used only the dedicated
`robinhoot_issue50_test` database, test-only credentials, and loopback port
55450. Build, TypeScript, strict OpenSpec validation, and whitespace checks pass.
Read-only full ESLint has zero errors and the same two pre-existing auth-test
warnings. Advisory Fallow audit passes without introduced findings after
registering e2e entry points; architecture dependencies were reviewed manually
because automatic boundaries are not configured.

See [contract examples and API/UI handoff](../../../docs/contracts/lobby-admission.md),
[component/sequence/state diagrams](../../../docs/architecture/lobby-admission.md),
and [real transport suite](../../../test/lobby.gateway.e2e-spec.ts). The admission
receipt is bound to the original connection and normalized nickname; a copied
UUID never discloses a secret. At most thirty receipts are retained per room;
disconnect clears their plaintext secrets while preserving room/player verifiers
and reserved slots. The limiter defaults to ten attempts/connection and sixty
attempts/source in sixty seconds, with a 10,000-source table; RoomModule's Symbol
binding configures these pilot limits. Closed admission is tested with internal
closed state; closure commands/timers remain #53. No migration, production
database, UI implementation, or external maintainer message. Tasks 3.1–3.3 remain
pending for #52–#53, and this change is not ready to archive.

## 3. Restore and close the lobby

- [x] 3.1 Test credential-bound reconnect then implement atomic session subscription/state sync; verify reload retains identity and one slot while nickname/socket-ID impersonation and cross-room credentials fail.
- [x] 3.2 Test host reauthentication, replacement-connection authority, thirty-minute expiry, owner cancellation, and 120-second host absence with fake time; verify cancellation reasons and cleanup of credentials/timers/receipts.
- [x] 3.3 Document lifecycle/error codes and run an API host/two-guest reconnect test with real Socket.IO clients; verify room isolation, relevant suites, the API build, and architecture boundaries.

Issue #52 evidence (2026-10-25): predecessor #51 is merged at `660457c`;
re-read actual admission/receipt/store behavior and main quiz-authoring,
user-auth, and jwt-guard specs. The full authoring predecessor is archived as
`2026-10-24-add-quiz-authoring`. No predecessor contract change was needed.
Credential restoration, receipt revocation, and current-connection state reads
were verified with failing-test/minimal-implementation slices. Real independent
Socket.IO clients verify host/two-guest reload without duplicate identity, live
replacement, obsolete sync/join/disconnect authority, guessed/cross-room/identity-only
rejection, malformed payloads, actor binding, retry revision stability, shared
attempt budgets, and host token revalidation after logout. Deliberately delayed
adapter subscriptions verify intervening roster mutations in restore/sync/host
snapshots, subsequent event delivery, and rejection/removal of superseded pending
subscriptions. Application tests also cover restoration at thirty-player capacity
and closed/unknown rooms.

Verification: 104 unit tests / 18 suites; 128 integration tests / four suites;
52 e2e tests / two suites (48 real Socket.IO behaviors and four existing auth/roles
checks). All database-backed checks used only `robinhoot_issue50_test` on loopback
port 55450 with dedicated test-only credentials. Build, TypeScript, scoped ESLint,
formatting, strict OpenSpec validation, and whitespace checks pass. Full read-only
ESLint has zero errors and the same two pre-existing auth guard test warnings.
The final advisory Fallow audit passes with no introduced dead code, complexity,
or duplication findings after consolidating receipt/subscription/test helpers.
Architecture direction was reviewed manually: the crypto verifier remains behind
its application Symbol port, transport subscription/eviction stays in the gateway,
and the domain and synchronous immutable store retain their boundaries.

See [restore/sync examples and API/UI handoff](../../../docs/contracts/lobby-restoration.md),
[updated admission contract](../../../docs/contracts/lobby-admission.md),
[sequence/state diagrams](../../../docs/architecture/lobby-admission.md), and
[real-client suite](../../../test/lobby.gateway.e2e-spec.ts). No production database,
schema migration, UI implementation, or external maintainer message. Task 3.1 is
complete and reconnect-related verification from 3.3 is recorded here. Keep
3.2–3.3 pending for #53's lifecycle, host replacement policy, cancellation, expiry,
and cleanup verification; do not archive this change yet.

Issue #53 evidence (2026-10-25): predecessor #52 merged at `50d6e7f`;
re-read actual restoration/admission/store and authentication behavior, main
quiz-authoring/user-auth/jwt-guard specs, and the archived authoring predecessor.
No predecessor contract changes were needed. The full lobby API acceptance is
now verified: owned immutable creation, safe bounded admission, credential-bound
restoration/current-connection authority, consistent subscribed snapshots, owner
cancellation, creation-based thirty-minute expiry, and the 120-second host return
window. Closure removes the live aggregate, all room credentials/admission and
creation receipts, owner/PIN indexes, both timers, and channel subscriptions.

Lifecycle behaviors were developed with failing-test/minimal-implementation
slices, then exercised with production timers under fake time and real independent
Socket.IO clients. Tests cover original closure retry/revision, malformed commands,
guest/foreign/revoked-token denial, timely return with existing roster, replaced
host sync/cancel/disconnect denial, return/admission at exact deadlines even before
callback dispatch, earliest terminal reason, repeated/stale callbacks, same-owner
and PIN replacement-room safety, tombstone expiry/cap, shutdown, isolation, and
closure/supersession during deliberately delayed subscriptions.

Verification: 117 unit tests / 19 suites; 128 integration tests / four suites;
65 e2e tests / two suites (61 real Socket.IO behaviors plus four auth/roles tests).
Database-backed checks used only `robinhoot_issue50_test`, loopback port 55450,
and test-only credentials. The room runtime port controls lifecycle time in
transport tests while real TCP, JWT, database validation, and HTTP creation run
normally. Build, TypeScript, formatting, strict OpenSpec validation, and whitespace
checks pass. Full read-only ESLint has no errors and the same two pre-existing
auth-test warnings. Advisory Fallow audit passes with zero dead-code, complexity, or duplication
findings. Automatic architecture boundaries are not configured; dependency
direction was reviewed manually. Application/domain import no transport
or timer implementations; runtime/events/lifecycle ports use Symbol DI bindings.

See [lifecycle contract and UI handoff](../../../docs/contracts/lobby-lifecycle.md),
[updated architecture](../../../docs/architecture/lobby-admission.md),
[fake-time lifecycle suite](../../../src/room/application/services/lobby-lifecycle.service.spec.ts),
and [real-client acceptance suite](../../../test/lobby.gateway.e2e-spec.ts).
Tasks 3.2–3.3 are complete. All API acceptance evidence and contract examples are
recorded before archival; review this focused PR before the separate archival/main
spec synchronization step. No production database, schema migration, deployment,
UI implementation, or external maintainer message.

## Workflow follow-up

- Published issue tracking: [#50](https://github.com/CusmaLinux/robinhoot/issues/50) — 1.1–1.4; [#51](https://github.com/CusmaLinux/robinhoot/issues/51) — 2.1–2.4; [#52](https://github.com/CusmaLinux/robinhoot/issues/52) — 3.1 and reconnect-related 3.3 verification; [#53](https://github.com/CusmaLinux/robinhoot/issues/53) — 3.2–3.3. See [issue map](../../../docs/mvp-issue-map.md) for blockers and classification. Issue creation does not complete these tasks.

- Review the implemented diff and acceptance evidence before archiving this change.
- Archive after API implementation/verification and documented contract handoff, then confirm its requirements are present in main specs; UI completion is tracked separately.
- Reconcile the next change against the resulting main specs before applying it.

- Link related UI issues in the separate repository once their real URLs are known; screen implementation, browser accessibility, and joint professor rehearsal are external product follow-up.
