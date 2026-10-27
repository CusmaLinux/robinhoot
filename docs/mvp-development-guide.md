# Robinhoot MVP development guide

## Product objective

The product objective is to enable a professor to create a quiz, run it live with a classroom, and identify questions students struggled with. This repository delivers the API supporting that objective. The UI already exists in a separate repository and owns the user-facing experience; API completion and the joint product pilot are distinct milestones.

This is a proposed roadmap, not an approved implementation contract. All six OpenSpec changes have now been drafted together at the user's request. Review their defaults before implementation, and reconcile later drafts with what earlier changes teach us before applying them.

## Current foundation

- NestJS 11, TypeScript, PostgreSQL, Kysely, JWT authentication, and `user`/`admin` roles already exist.
- Authentication uses a ports-and-adapters structure. New capabilities should follow the existing project conventions and `openspec/config.yaml`.
- OpenSpec uses the `spec-driven` schema. There are two archived authentication changes, six active MVP drafts, and six current main authentication specs reconstructed for issue #46. See [authentication baseline evidence](authentication-baseline.md).
- This is an API-only repository. The user maintains the UI in another repository. Do not add a frontend package, select its framework, implement screens, or deploy UI assets here. See [API/UI boundary](api-ui-boundary.md).
- The configured workflow calls for behavioral specs and TDD in small vertical slices.

Before implementing the first feature, merge issue #46's documentation PR and review its reconciled baseline and discrepancies. Historical deltas remain unchanged and are not a substitute for current main specs. Use `pnpm exec openspec list --specs --json` to inspect the baseline.

## Proposed API MVP boundary

| Area | Include in this API repository | Defer or coordinate externally |
| --- | --- | --- |
| Accounts | Existing professor authentication and guest room credentials | Login screens and client token storage belong to the UI; student accounts and new account-role hierarchies are deferred |
| Authoring | Private quiz CRUD, explicit ordering, incomplete drafts, hostability errors | The separate UI owns the editor; public library, imports, collaboration, and folders are deferred |
| Questions | Four-option single-answer multiple choice, True/False, optional validated HTTPS image references | The UI owns type controls, image rendering/fallback, and accessibility; uploads/video are deferred |
| Live game | Room/PIN admission, roster events, owner commands, authoritative timers, answers, reveal, scoring, restoration | The UI owns host/player screens, countdown display, control lockout, and connection feedback |
| Results | Persistent owned reports, shared-rank standings, accuracy and correct/incorrect/missing counts | The UI owns charts and report-history presentation; cross-session analytics/export are deferred |
| Hosting | One backend process, PostgreSQL, HTTPS/WSS API access, configurable UI origins | UI hosting/build/routing stay in the other repository; Redis/distributed live state are deferred |

Suggested pilot limits: thirty players per room, 1–20 questions per quiz, and one active room per professor. These are proposed product limits to validate, not measured capacity claims. Determine expected simultaneous classrooms before API deployment and test that workload.

For images, the API validates/stores/returns HTTPS references without fetching remote bytes or checking availability. The UI decides how to render and handle unavailable images. Confirm external-host availability/privacy expectations before the joint pilot; if uploads are required, scope them as a later API change.

External product requirements remain useful context: the UI needs labels/shapes beyond color, keyboard access, visible focus, accepted-answer feedback, two True/False controls or four multiple-choice controls, and a shared host question screen. Those are UI-repository work and are not API acceptance checks. The API supplies stable labeled options, explicit phase/deadline data, and acceptance/error payloads.

## Rules to decide before coding

Use these as proposed defaults. Change the specs first if a different classroom experience is needed.

1. Any authenticated `user` may create quizzes and host their own quiz. Resource ownership is checked separately from account roles. Being an `admin` does not implicitly grant control over someone else's live game.
2. Each question has exactly one correct answer. Multiple choice has exactly four nonempty options; True/False has two fixed options. Drafts may be incomplete, but a room cannot be created from an invalid quiz.
3. Per-question durations are selected from 10, 20, 30, or 60 seconds. Order is fixed and the host advances manually after each reveal.
4. A room gets a server-generated six-digit PIN unique among active rooms. It admits new players only in the lobby. Joining a closed, expired, or full room returns a clear error.
5. Nicknames are trimmed, 1–20 characters, and unique within a room ignoring case. A PIN and nickname do not grant access to an existing player's identity.
6. Joining returns an opaque player session credential. Reconnection uses that credential, never `socket.id` or nickname alone. Credentials are scoped to one room, expire with it, and must not appear in logs or broadcast payloads.
7. The server owns question opening time and deadline. An answer received at or after the deadline is rejected even if a delayed timer callback has not run. Clients display the countdown using server timing information.
8. Each player can submit one answer per question. Retries of the same submission return the original acknowledgement; a different second answer is rejected. Acknowledgement means accepted, not correct.
9. Correct answers earn 1,000 points; wrong or missing answers earn zero. No speed bonus in the first MVP. Equal totals share rank; nickname ordering can stabilize display without breaking ties.
10. Questions close at the deadline, even when everybody answers early. Correctness is revealed only after closure. No player-facing payload includes correct-answer metadata before reveal.
11. A room snapshots the validated quiz at creation. Subsequent edits or deletion of the saved quiz do not change the active game or completed report.
12. Brief player disconnections allow rejoining the same identity and score. They do not stop the timer. Answers already accepted stay accepted, and the player receives the current safe state after reconnecting.
13. A disconnected host has a proposed 120-second reconnect window. The current question continues and can close; progression waits for the host. If the host does not return within the window, cancel the room and tell players. Rejoining must revalidate host identity and room ownership.
14. No new players join after the first question opens. All players present at game start remain in question-result denominators, including those who disconnect. This makes missing answers explicit rather than silently improving accuracy.
15. Idle lobbies expire after a proposed 30 minutes. Explicit ending before the last question completes cancels the game. Cancelled games show a clear reason and do not produce a completed final report.
16. Live rooms are held in memory. A backend restart loses them; the API returns SESSION_UNAVAILABLE for stale room restoration, synchronization, and new answers. The UI owns session-unavailable presentation/navigation. Saved quizzes and successfully persisted completed reports survive restarts.

Proposed game states:

```text
LOBBY → QUESTION_OPEN → QUESTION_REVEAL → FINISHED
             ↑                 │
             └── next question ┘

Any active state → CANCELLED
```

Only the host starts, advances, ends, or requests finalization. Only the server closes questions and calculates scores. Finalization after the last reveal persists the report before announcing `FINISHED`; a failed write is retryable and must not create duplicate reports.

## Technical approach

| Concern | Proposed approach | Reason |
| --- | --- | --- |
| Backend | Existing NestJS application | Builds on current authentication and deployment |
| Persistent data | Existing PostgreSQL/Kysely | Store quizzes, ownership, question/options, completed game snapshots and result counts |
| Live transport | Socket.IO through a NestJS gateway | Rooms, acknowledgements, and reconnect support fit the game flow |
| Live state | In-memory room store behind a port | Keeps the pilot small and preserves an upgrade path |
| HTTP | Quiz editing, room creation, completed report retrieval | Familiar request/response workflows |
| Socket messages | Join/rejoin, host commands, answers, safe state broadcasts | Synchronizes the live experience |
| External UI integration | Existing UI in its separate repository; REST/OpenAPI plus documented Socket.IO contracts | No frontend framework, package, client routes, or UI deployment decisions in this repository |
| Time | Clock/scheduler ports | Tests can advance time without real countdown waits |

Keep domain rules independent of NestJS, Socket.IO, and Kysely. Gateways/controllers validate transport input and call application use cases. Use cases depend on ports with Symbol DI tokens; adapters provide the database, clock, live store, and event delivery.

Start with capability boundaries around quiz authoring, live games, and results. Keep round transitions, answer acceptance, and scoring together rather than splitting them into independent services prematurely. Avoid creating generic infrastructure before a feature needs it.

The current role guard reads an HTTP request. WebSocket authentication and authorization need explicit handling; do not assume an HTTP guard protects socket messages. Validate every host command and bind player submissions to the authenticated room session. Rate-limit PIN guesses, joins, and answer messages at the relevant boundary.

Socket.IO's default delivery is at most once, and recovery can fail. Specify acknowledgements, idempotent commands/submissions, and an explicit current-state synchronization path. Include room/question identifiers and a state revision in the event contract so clients can discard stale updates. Separate host and player projections to avoid leaking answers or credentials.

## Ordered OpenSpec changes

Each change includes complete API behaviors with use-case/domain work, persistence where needed, transport contracts, and relevant verification. Create actionable API issues and focused PRs here. Link separate UI issues once actual repository links are available. Do not turn an API PR into a frontend implementation dependency.

| Order / change name | API deliverable | API acceptance checkpoint |
| --- | --- | --- |
| 1. `add-quiz-authoring` | Private text multiple-choice quiz CRUD, ordering, draft and hostable validation | Create/save/read a two-question quiz through HTTP; a second account cannot access it |
| 2. `add-game-lobby` | Owned quiz snapshot, PIN room, guest admission, safe roster, restore, limits, and expiry | One host/two guest Socket.IO clients receive consistent state; restore retains identity and foreign host commands fail |
| 3. `play-live-question` | Start, server deadline, one accepted answer, reveal, scoring, and active restore | API clients complete a round; late/conflicting retries cannot change scoring and public payloads reveal no early correctness |
| 4. `finish-game-with-results` | Manual progression, cancellation, durable finish, rankings and question-count responses | A complete API game produces retrievable stable reports after restart and one report under finalization retry |
| 5. `add-question-media-and-true-false` | Typed two/four-option payloads and image metadata across authoring, snapshots, and reports | A mixed API game and legacy quiz work; unreachable images cause no backend fetch or timing/acceptance dependency |
| 6. `prepare-professor-pilot` | API deployment, configured UI origins, contract docs, workload/availability checks, and operator handoff | Documented HTTP/socket flows pass on staging at the measured classroom envelope with explicit stale-session errors |

For changes 1–3, build only the contracts and behavior needed at that stage. For example, change 2 defines lobby reconnect; change 3 extends it to active questions. Do not mark future-stage behavior complete because its interface exists.

The drafted capabilities are `quiz-authoring`, `game-lobby`, `live-gameplay`, `game-progression`, `game-results`, `quiz-question-formats`, and `classroom-pilot`. These describe behaviors. A socket gateway, database table, or clock adapter belongs in design/tasks rather than becoming its own product capability spec.

### Drafted OpenSpec artifacts

Published delivery tracking: [MVP API epic #44](https://github.com/CusmaLinux/robinhoot/issues/44) and the [issue-to-change/task map](mvp-issue-map.md). Planning publication and authentication baseline reconciliation are tracked in [#46](https://github.com/CusmaLinux/robinhoot/issues/46); all feature issues depend on that baseline through their blocker chains.

Private quiz authoring tasks 1.1–4.3 are complete through issues #46–#49, with the full change archived and its [main specification](../openspec/specs/quiz-authoring/spec.md) published. The [HTTP walkthrough](contracts/quiz-authoring-walkthrough.md) records its acceptance and contract handoff. Lobby and subsequent feature tasks remain pending. OpenSpec artifact readiness means planning documents exist, not that features are implemented. Follow the order below. Cross-change prerequisites are documented review gates, not dependencies enforced by the CLI.

| Change | Proposal | Behavioral specs | Design | Tasks |
| --- | --- | --- | --- | --- |
| 1. Quiz authoring | [Proposal](../openspec/changes/archive/2026-10-24-add-quiz-authoring/proposal.md) | [Authoring](../openspec/changes/archive/2026-10-24-add-quiz-authoring/specs/quiz-authoring/spec.md) | [Design](../openspec/changes/archive/2026-10-24-add-quiz-authoring/design.md) | [Tasks](../openspec/changes/archive/2026-10-24-add-quiz-authoring/tasks.md) |
| 2. Lobby | [Proposal](../openspec/changes/archive/2026-10-26-add-game-lobby/proposal.md) | [Lobby](../openspec/changes/archive/2026-10-26-add-game-lobby/specs/game-lobby/spec.md) | [Design](../openspec/changes/archive/2026-10-26-add-game-lobby/design.md) | [Tasks](../openspec/changes/archive/2026-10-26-add-game-lobby/tasks.md) |
| 3. Live round | [Proposal](../openspec/changes/archive/2026-10-26-play-live-question/proposal.md) | [Gameplay](../openspec/changes/archive/2026-10-26-play-live-question/specs/live-gameplay/spec.md) | [Design](../openspec/changes/archive/2026-10-26-play-live-question/design.md) | [Tasks](../openspec/changes/archive/2026-10-26-play-live-question/tasks.md) |
| 4. Full game and results | [Proposal](../openspec/changes/archive/2026-10-27-finish-game-with-results/proposal.md) | [Progression](../openspec/changes/archive/2026-10-27-finish-game-with-results/specs/game-progression/spec.md), [results](../openspec/changes/archive/2026-10-27-finish-game-with-results/specs/game-results/spec.md) | [Design](../openspec/changes/archive/2026-10-27-finish-game-with-results/design.md) | [Tasks](../openspec/changes/archive/2026-10-27-finish-game-with-results/tasks.md) |
| 5. Formats and images | [Proposal](../openspec/changes/add-question-media-and-true-false/proposal.md) | [Question formats](../openspec/changes/add-question-media-and-true-false/specs/quiz-question-formats/spec.md) | [Design](../openspec/changes/add-question-media-and-true-false/design.md) | [Tasks](../openspec/changes/add-question-media-and-true-false/tasks.md) |
| 6. Professor pilot | [Proposal](../openspec/changes/prepare-professor-pilot/proposal.md) | [Classroom pilot](../openspec/changes/prepare-professor-pilot/specs/classroom-pilot/spec.md) | [Design](../openspec/changes/prepare-professor-pilot/design.md) | [Tasks](../openspec/changes/prepare-professor-pilot/tasks.md) |

### Defining question difficulty data

For every question, persist its snapshot and counts for eligible players, correct answers, incorrect answers, and no answer. Compute correct percentage as `correct / eligible × 100`; the lowest percentage is the hardest. Include timeouts in the denominator and return the no-answer count separately. Do not divide only by submitted answers. Preserve enough facts to support the UI's chart after the live room has been removed.

## Workflow for each change

1. Explore only the next change's unknowns with `$openspec-explore`.
2. Read its existing artifacts and revise them if needed. Use `$openspec-propose <change-name>` for a new change; the six roadmap changes already exist. In Codex these are skill invocations in chat, not shell commands.
3. Review the four artifacts before requesting implementation:
   - `proposal.md`: user problem, scope, exclusions, dependencies, impact, affected teams/people, and rollback plan.
   - `specs/<capability>/spec.md`: observable requirements and Given/When/Then scenarios, including failures and unauthorized actions.
   - `design.md`: proposed storage, public API/event contract, state transitions, trust boundaries, alternatives, and unresolved decisions.
   - `tasks.md`: small vertical steps that each implement and verify an API behavior; include API contract documentation and migration work where needed. Record UI work as separate-repository follow-up.
4. Validate the artifacts and inspect status:

   ```bash
   pnpm exec openspec status --change add-game-lobby --json
   pnpm exec openspec validate add-game-lobby --strict
   ```

5. Request `$openspec-apply-change <change-name>`, optionally limiting the instruction to a named task group. Follow the configured one-test/one-behavior TDD loop.
6. Review the API diff and demonstrate its acceptance checkpoint using HTTP/Socket.IO clients. Run relevant unit/integration/e2e tests and the API build; database tests must use a dedicated test database. Inspect any lint fixes. Spec validation alone does not establish that behavior works.
7. If behavior or a design decision changes during implementation, update the artifacts before proceeding. Do not silently expand scope or mark unverified tasks complete.
8. When API implementation, verification, and the documented contract handoff are complete, use `$openspec-archive-change <change-name>` to merge deltas into main specs. UI completion is tracked separately and does not block API archival. Use `$openspec-sync-specs` if main specs need updating before archival. Verify that main specs exist afterward.

The roadmap belongs in this guide. Stable implemented behavior belongs in `openspec/specs/`. Pending behavior and its implementation plan belong in `openspec/changes/<change-name>/`.

### Example behavioral scenario

```markdown
## ADDED Requirements

### Requirement: Answers close at the server deadline
The system SHALL reject answers received at or after the active question's deadline.

#### Scenario: An answer arrives at the deadline
- **GIVEN** a question is open with a server deadline of T
- **WHEN** the server receives a player's answer at T
- **THEN** it rejects the submission as too late
- **AND** it leaves that player's score unchanged
```

Other valuable scenarios: editing another user's quiz; starting an invalid quiz; joining a full room; a non-owner sending a host command; retrying an accepted answer after losing its acknowledgement; reconnecting after reveal; finalization when persistence fails; reloading a completed report.

## Historical first review prompt

The authoring review below is retained as the original planning example. Authoring is now archived; review `add-game-lobby` against the main authoring spec before starting the next stage.

```text
$openspec-explore add-quiz-authoring

Review the existing add-quiz-authoring proposal, specs, design, and tasks using
docs/mvp-development-guide.md as the roadmap. Review the reconciled authentication
baseline, its recorded discrepancies, and the API/UI boundary. Identify any API contract decisions
to revise before implementation. Do not implement application code.

Allow authenticated users to create, list, edit, reorder, and delete their own
private quizzes. Support text-only multiple-choice questions with four options
and exactly one correct option. Allow incomplete saved drafts and specify the
validation needed to make a quiz hostable. Cover ownership failures and use
the existing hexagonal architecture, Kysely persistence, and TDD conventions.

Keep this repository API-only. Review REST/OpenAPI inputs, outputs, ownership,
validation, and errors for the existing separate UI. Defer live rooms, images,
and True/False. Do not create a frontend package or implement UI screens here.
```

## API completion and joint product pilot

The API MVP is complete when its documented HTTP/socket contracts support owned mixed quizzes, the measured guest/classroom workload, all rounds, brief client restoration, durable finish, and owned report retrieval. Verify room isolation, exact deadline behavior, safe payloads, explicit failures, and SQL persistence with API clients. Active-game crash recovery remains deferred.

The full product pilot requires the separate UI to integrate those contracts and verify layouts, accessible controls, mobile/browser behavior, professor instructions, and an unaided classroom rehearsal on the intended network. Record those as linked UI/product work rather than API implementation tasks.

Use cases still guide API issues: save a draft, create a room, join, submit, restore, advance, and retrieve reports. Each actionable issue should link its OpenSpec requirements, define API acceptance checks, and deliver its own contract documentation and tests. One focused PR per actionable API issue is a useful review boundary; archive the OpenSpec change after all its API work passes.

Collect joint product feedback about whether professors can finish unaided, players can join/answer reliably, and question difficulty results inform teaching. Those observations drive later proposals; passing API workload checks alone does not establish that user experience.

## References

- [OpenSpec concepts](https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md): change artifacts and main specifications.
- [NestJS gateways](https://docs.nestjs.com/websockets/gateways): gateway integration and supported adapters.
- [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/): default delivery semantics and application responsibilities.
- [Socket.IO connection state recovery](https://socket.io/docs/v4/connection-state-recovery/): temporary recovery and the need for synchronization when recovery fails.
