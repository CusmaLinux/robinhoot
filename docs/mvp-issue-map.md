# MVP API issue map

Parent: [Robinhoot API MVP #44](https://github.com/CusmaLinux/robinhoot/issues/44).

These issues were published from the six API-only OpenSpec drafts. Creating issues does not complete implementation tasks. Publish the planning baseline through [#46](https://github.com/CusmaLinux/robinhoot/issues/46) before feature code, then implement in dependency order. The UI is maintained in a separate repository.

AFK means the issue follows the agreed contract once blockers are complete; normal PR review remains required. HITL means an explicit human decision is needed. Dependencies below are documented links, not native GitHub blocking relationships.

## 1. Private quiz authoring

API implementation and verification are complete through #49; the full change is archived and its requirements are published in the [main authoring spec](../openspec/specs/quiz-authoring/spec.md). See the [acceptance walkthrough](contracts/quiz-authoring-walkthrough.md). Normal PR review remains required.

OpenSpec: [proposal](../openspec/changes/archive/2026-10-24-add-quiz-authoring/proposal.md), [design](../openspec/changes/archive/2026-10-24-add-quiz-authoring/design.md), [tasks](../openspec/changes/archive/2026-10-24-add-quiz-authoring/tasks.md).

| Issue | Type | Task coverage | Blocked by |
| --- | --- | --- | --- |
| [#46: Publish the API MVP plan and reconcile authentication specs](https://github.com/CusmaLinux/robinhoot/issues/46) | AFK | 1.1–1.3 | None |
| [#47: Create, list, and retrieve private quiz drafts](https://github.com/CusmaLinux/robinhoot/issues/47) | AFK | 2.1–2.3 | [#46](https://github.com/CusmaLinux/robinhoot/issues/46) |
| [#48: Edit and reorder multiple-choice quizzes with hostability validation](https://github.com/CusmaLinux/robinhoot/issues/48) | AFK | 3.1–3.4 | [#47](https://github.com/CusmaLinux/robinhoot/issues/47) |
| [#49: Delete owned quizzes without weakening ownership boundaries](https://github.com/CusmaLinux/robinhoot/issues/49) | AFK | 4.1–4.3 | [#48](https://github.com/CusmaLinux/robinhoot/issues/48) |

## 2. PIN rooms and lobby sessions

The full lobby API change is verified and archived as `2026-10-26-add-game-lobby`;
its requirements are published in the [main lobby spec](../openspec/specs/game-lobby/spec.md).

OpenSpec: [proposal](../openspec/changes/archive/2026-10-26-add-game-lobby/proposal.md), [design](../openspec/changes/archive/2026-10-26-add-game-lobby/design.md), [tasks](../openspec/changes/archive/2026-10-26-add-game-lobby/tasks.md).

| Issue | Type | Task coverage | Blocked by |
| --- | --- | --- | --- |
| [#50: Create owned PIN rooms from immutable quiz snapshots](https://github.com/CusmaLinux/robinhoot/issues/50) | AFK | 1.1–1.4 | [#49](https://github.com/CusmaLinux/robinhoot/issues/49) |
| [#51: Admit guests and broadcast safe lobby rosters](https://github.com/CusmaLinux/robinhoot/issues/51) | AFK | 2.1–2.4 | [#50](https://github.com/CusmaLinux/robinhoot/issues/50) |
| [#52: Restore lobby sessions with room-scoped credentials](https://github.com/CusmaLinux/robinhoot/issues/52) | AFK | 3.1 and reconnect-related 3.3 verification | [#51](https://github.com/CusmaLinux/robinhoot/issues/51) |
| [#53: Expire and cancel lobbies with explicit closure events](https://github.com/CusmaLinux/robinhoot/issues/53) | AFK | 3.2–3.3 | [#52](https://github.com/CusmaLinux/robinhoot/issues/52) |

## 3. Timed live question

OpenSpec: [proposal](../openspec/changes/play-live-question/proposal.md), [design](../openspec/changes/play-live-question/design.md), [tasks](../openspec/changes/play-live-question/tasks.md).

| Issue | Type | Task coverage | Blocked by |
| --- | --- | --- | --- |
| [#54: Run a timed question with automatic reveal](https://github.com/CusmaLinux/robinhoot/issues/54) | AFK | 1.1–1.4 and deadline closure portion of 3.1 | [#53](https://github.com/CusmaLinux/robinhoot/issues/53) |
| [#55: Accept one answer per player and score it exactly once](https://github.com/CusmaLinux/robinhoot/issues/55) | AFK | 2.1–2.4 and scoring portion of 3.1 | [#54](https://github.com/CusmaLinux/robinhoot/issues/54) |
| [#56: Recover active game state after player or host disconnects](https://github.com/CusmaLinux/robinhoot/issues/56) | AFK | 3.2–3.4 | [#55](https://github.com/CusmaLinux/robinhoot/issues/55) |

## 4. Complete games and durable reports

OpenSpec: [proposal](../openspec/changes/finish-game-with-results/proposal.md), [design](../openspec/changes/finish-game-with-results/design.md), [tasks](../openspec/changes/finish-game-with-results/tasks.md).

| Issue | Type | Task coverage | Blocked by |
| --- | --- | --- | --- |
| [#57: Advance through quiz questions and cancel unfinished games](https://github.com/CusmaLinux/robinhoot/issues/57) | AFK | 1.1–1.4 | [#56](https://github.com/CusmaLinux/robinhoot/issues/56) |
| [#58: Finalize a game once and persist its report before completion](https://github.com/CusmaLinux/robinhoot/issues/58) | AFK | 2.1–2.4 | [#57](https://github.com/CusmaLinux/robinhoot/issues/57) |
| [#59: Retrieve owned rankings and question difficulty reports](https://github.com/CusmaLinux/robinhoot/issues/59) | AFK | 3.1–3.4 | [#58](https://github.com/CusmaLinux/robinhoot/issues/58) |

## 5. True/False and question image metadata

OpenSpec: [proposal](../openspec/changes/add-question-media-and-true-false/proposal.md), [design](../openspec/changes/add-question-media-and-true-false/design.md), [tasks](../openspec/changes/add-question-media-and-true-false/tasks.md).

| Issue | Type | Task coverage | Blocked by |
| --- | --- | --- | --- |
| [#60: Support True/False questions through authoring, gameplay, and reports](https://github.com/CusmaLinux/robinhoot/issues/60) | AFK | 1.1–1.4 and 2.1–2.2 | [#59](https://github.com/CusmaLinux/robinhoot/issues/59) |
| [#61: Carry validated question image metadata without fetching remote images](https://github.com/CusmaLinux/robinhoot/issues/61) | AFK | 3.1–3.4 | [#60](https://github.com/CusmaLinux/robinhoot/issues/60) |

## 6. API deployment and classroom readiness

OpenSpec: [proposal](../openspec/changes/prepare-professor-pilot/proposal.md), [design](../openspec/changes/prepare-professor-pilot/design.md), [tasks](../openspec/changes/prepare-professor-pilot/tasks.md).

| Issue | Type | Task coverage | Blocked by |
| --- | --- | --- | --- |
| [#62: Rehearse API deployment, readiness, and database recovery](https://github.com/CusmaLinux/robinhoot/issues/62) | HITL | 1.1–1.4 | [#61](https://github.com/CusmaLinux/robinhoot/issues/61) |
| [#63: Verify HTTP and live-session integration from the separate UI origins](https://github.com/CusmaLinux/robinhoot/issues/63) | AFK | 2.1–2.2 | [#62](https://github.com/CusmaLinux/robinhoot/issues/62) |
| [#64: Reject stale sessions after restart, expiry, and PIN reuse](https://github.com/CusmaLinux/robinhoot/issues/64) | AFK | 2.3–2.4 | [#63](https://github.com/CusmaLinux/robinhoot/issues/63) |
| [#65: Measure classroom workload and concurrent-room isolation](https://github.com/CusmaLinux/robinhoot/issues/65) | AFK | 3.1–3.2 | [#64](https://github.com/CusmaLinux/robinhoot/issues/64) |
| [#66: Publish verified API pilot evidence and the UI integration handoff](https://github.com/CusmaLinux/robinhoot/issues/66) | AFK | 3.3–3.4 | [#65](https://github.com/CusmaLinux/robinhoot/issues/65), [#62](https://github.com/CusmaLinux/robinhoot/issues/62), [#63](https://github.com/CusmaLinux/robinhoot/issues/63), [#64](https://github.com/CusmaLinux/robinhoot/issues/64) |

## Existing related work

- [#43](https://github.com/CusmaLinux/robinhoot/issues/43): WebSocket research and the original fifty-concurrent-connection goal.
- [#28](https://github.com/CusmaLinux/robinhoot/issues/28): general CORS/CSP configuration.
- [#21](https://github.com/CusmaLinux/robinhoot/issues/21) and [#40](https://github.com/CusmaLinux/robinhoot/issues/40): container/deployment groundwork.
- [#10](https://github.com/CusmaLinux/robinhoot/issues/10): documentation strategy.
- [#32](https://github.com/CusmaLinux/robinhoot/issues/32): session research to coordinate with the existing account/guest credential model.

The related issues were referenced, not closed or rewritten. Link actual UI issues when available; no UI repository or issue URLs are assumed.

## Completion

Use one focused API PR per actionable issue and update the covered OpenSpec task checkboxes only as the work is verified. Archive an OpenSpec change after all its API issues/tasks and documented contract handoff are complete. Reconcile later drafts against the resulting main specs. See [API/UI boundary](api-ui-boundary.md) and [MVP guide](mvp-development-guide.md).
