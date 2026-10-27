# Design

## Context

Apply after play-live-question is archived. Review its real state/event contract first. Behavior is split into specs/game-progression/spec.md and specs/game-results/spec.md, while live transitions remain in the existing live-game boundary.

## Goals / Non-Goals

Repository boundary: this is an API-only change. The existing UI is an external consumer maintained in another repository. See [API/UI boundary](../../../docs/api-ui-boundary.md) for contract handoff and completion responsibilities.

Goals: ordered full-game transitions, exactly one durable final report, and understandable owned history.
Non-goals: partial reports for cancelled games, cross-game student identity, exports, or live restart recovery.

## Decisions

1. Extend host commands with host.next and host.finish using commandId/expectedRevision. Reuse serialized mutations and receipt lookup. next works only at reveal with a remaining question. finish works only at the last reveal; a host may still explicitly cancel before completion.
2. Rank using fixed total scores and competition ranks (1,1,3). Sort equal scores by normalized nickname solely for stable rendering. Freeze denominator at the roster captured on start; disconnected players remain eligible for every question. Missing = eligible - correct - incorrect; accuracy = correct / eligible. Start already requires a nonempty roster, so a completed report cannot have zero eligible players.
3. Use a ReportRepository output port and a Kysely adapter. One PostgreSQL report row per room UUID stores owner ID, versioned immutable quiz snapshot, standings, question counts, and completion time in a bounded JSONB document. Add a unique room ID constraint and owner index; no foreign key cascade from saved quiz to reports. Aggregate snapshots simplify historical reads and avoid duplicating every live event in SQL.
4. Capture a deterministic report candidate and freeze transitions while a finalization write is in progress. Keep public phase at last reveal with a finalizing indicator; reject answer/next/cancel mutations during the short write. Insert/upsert idempotently by room ID, returning the original stored report on conflict. Only then commit FINISHED and broadcast. On storage failure retain the same candidate at reveal and show a retryable error; restore normal host cancellation once the write fails. Do not announce success speculatively.
5. If a storage write succeeds but its response is lost, a retry reads the same stored room report. If the backend crashes during finalization, owners can discover any successfully stored report through history; the live room itself is unavailable. No promise to recover unsaved active games.
6. Add authenticated GET /reports and GET /reports/:id. Filter by actual owner and return 404 for foreign/missing reports, including requests by admins. A room credential authorizes only active/final room projections, not history endpoints. No credentials or account emails are persisted in report payloads; guest nicknames and game scores are sufficient.
7. Report responses include per-question eligible/correct/incorrect/missing counts and accuracy plus final ranked standings. Lowest accuracy is hardest; equal percentages tie. Players receive final standings through connected-session payloads. The UI owns charts, history links, and final screens. Persist reports before cleanup, retain FINISHED room snapshots for a bounded period (proposed ten minutes), then clear all room credentials/timers/receipts. PIN admission closes throughout.
8. Remove the 120-second owner-absence cancellation during an in-flight finalization write and settle pending callbacks against the current phase. A failed write returns to reveal and reevaluates any expired absence deadline; a successful write resolves to FINISHED. This avoids reporting both cancellation and completion for the same room.

## Risks / Trade-offs

- Database outage → bounded query timeout and retryable finalization; demonstrate failure and ack-loss cases.
- Historical payload evolution → version the stored document and keep compatible readers.
- Accidental report access → owner-filtered queries and negative transport tests.
- Guest nickname data grows indefinitely → set and document retention before the pilot; deletion policy remains a deployment decision, not a new analytics feature.

## Migration Plan

Add reports table/index and repository before enabling finish commands and history endpoints. Verify migration and atomic writes on the test database. Publish ranking/count/error examples for the UI and deploy compatible API readers first. On rollback disable new finalization if necessary and keep stored reports backed up/readable. Do not drop report data as an automatic rollback.

## Predecessor reconciliation — issue #57 (2026-10-26)

Before extending live transitions, reviewed the merged #54–#56 implementation,
full 12/12 predecessor task evidence, recovery transcript, and current main
`game-lobby`, `quiz-authoring`, `user-auth`, and `jwt-guard` specifications.
Reran 160 unit, 128 integration, and 104 e2e tests plus build, type, formatting,
and read-only lint checks on the dedicated loopback test database. Synced all
six `live-gameplay` requirements and archived the predecessor as
`2026-10-26-play-live-question`, then re-read the resulting main spec.

The agreed #57 contract authorizes tasks 1.1–1.4 and the one-behavior TDD plan.
Keep synchronous immutable room mutations, existing Symbol DI, current owner
connection checks and per-message JWT validation. `host.next` uses the same
UUID/revision payload as start and returns the current public question state.
Retain revealed rounds inside the room (bounded by twenty snapshot questions),
including start/next command fingerprints, frozen initial eligibility, private
answer receipts, and per-question scores. Lookup accepted commands before
phase/revision checks; ID reuse across command types is `COMMAND_CONFLICT`.
Current guest scores sum all revealed rounds; current acceptance is question-local.
Old accepted answer retries remain retrievable after progression; a new answer
for an old question is `WRONG_QUESTION`.

Reuse `host.cancel` and the existing lifecycle closure: `lobby.closed`,
`phase:closed`, reason `OWNER_CANCELLED`, one revision, timer release, removal
of live room data, and bounded five-minute tombstone. No completed report or
finished event is produced; no report repository exists in this slice.
Durable completion, ranking, and report persistence remain #58, and owned
history remains #59. Do not archive this overall change for #57 alone.


## Finalization reconciliation — issue #58 (2026-10-27)

Re-read the archived predecessor's resulting main `live-gameplay` spec and the
merged #57 implementation (`f365092`) before extending its synchronous room
mutations. `FinishGameService` is a separate inbound use case; the existing
live-question service retains ownership of scoring and progression. New Symbol
ports cover finalization, report persistence and completion events, composed in
`RoomModule`. A pending per-room promise serializes the asynchronous write while
the synchronous `finalizing` flag blocks conflicting commands and lifecycle
cancellation. Public phase remains reveal until the transaction commits.

Report IDs equal room UUIDs. The version-1 JSONB document includes owner ID,
first-attempt completion timestamp, full immutable quiz snapshot, competition
standings and per-question counts/percentage accuracy. The unique room primary
key and owner-filtered read return the first committed owned report unchanged.
Returned/candidate reports are deeply frozen. No source-quiz/account foreign key
can cascade-delete reports. Automatic migration rollback refuses to drop them.

The original finish fingerprint is checked before revision validation so its
retry survives roster reconnection revisions after storage failure. Accepted
start/next IDs conflict with finish, and changed content on the original finish
ID conflicts. Valid concurrent finish commands share one write; acknowledged
finish retries return the same report without republishing completion.
Failed saves preserve the candidate, restore cancellation and settle/rearm any
host absence. Successful saves disarm absence; finished disconnects never start
new cancellation timers. History/retention remain #59, so this change stays open.


## History and retention reconciliation — issue #59 (2026-10-27)

Re-read the actual main `live-gameplay`, `game-lobby`, and `quiz-authoring`
specifications, the archived `play-live-question` prerequisite, and merged #58
before extending the report contract. The predecessor remains fully archived;
this slice implements the final retrieval tasks of the current change.

`GET /reports` returns owned version-1 documents newest first, stabilizing equal
completion timestamps by room UUID. `GET /reports/:id` validates the UUID and
returns the original owned document or an indistinguishable missing/foreign 404.
Global account JWT validation supplies owner identity; admin status has no
cross-owner override, and room credentials cannot authenticate historical reads.
A separate read use-case/port keeps history independent of live-room services;
Symbol DI shares the Kysely adapter with the existing write port. Stored documents
and public report schemas retain their own snapshot format independently of
editable source quizzes.

The proposed ten-minute FINISHED retention is now the fixed implementation
policy. Finalization schedules one cleanup deadline, checked by both timer and
live reads. Rebinding, synchronization and retries cannot extend it. Cleanup
removes the room aggregate, credentials, receipts, indexes and lifecycle entry,
without cancellation events, tombstones or durable-report deletion. Stale
callbacks cannot affect a replacement UUID. Persisted history remains readable
after cleanup, source edits/deletion and a fresh backend instance.

The [history contract](../../../docs/contracts/report-history.md) provides the
API/UI handoff, exact 1/1/3 rankings for 2000/2000/1000 totals, 25/75 percent
question-count examples, security errors, lifetime policy and executable
HTTP/Socket.IO acceptance evidence. UI rendering and professor rehearsal remain
external follow-up. Durable report retention/deletion remains an operational
policy to settle before the pilot.
