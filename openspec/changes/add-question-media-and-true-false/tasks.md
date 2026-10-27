# Tasks

Work one tested behavior at a time: failing test, minimal implementation, then refactor. Checked boxes record verified API work; planning alone does not complete implementation.

## 1. Extend the question format compatibly

- [x] 1.1 Verify finish-game-with-results is implemented and archived; inspect actual persisted versions and update this design before changing payloads.
- [x] 1.2 Write one failing True/False authoring behavior then extend the question union and hostability validation; verify two fixed choices, exactly one correct choice, and supported durations.
- [x] 1.3 Test and implement API validation for question-type updates; verify stale option IDs or correct-choice mappings from the old type are rejected and document valid conversion payloads.
- [x] 1.4 Add old quiz/report compatibility fixtures and only necessary additive migrations; verify existing multiple-choice content still loads, validates, and serializes correctly.

## 2. Carry True/False through a game

- [x] 2.1 Test a True/False API round then extend snapshot/event payloads through existing option-ID handling; verify two labeled options and unchanged deadline, reveal, and scoring rules.
- [x] 2.2 Extend report responses for question types and fixed choices; verify a mixed two-question game stores accurate snapshot content/counts and document the format contract.

## 3. Add optional image references

- [x] 3.1 Test valid/invalid image references then add bounded HTTPS URL validation and API serialization without backend fetching; verify malformed, credential-bearing, and non-HTTPS references are rejected.
- [x] 3.2 Document and test optional image metadata in host/report payloads; verify an unreachable image reference triggers no backend fetch or availability wait and does not block round opening or valid answers.
- [x] 3.3 Test source image/type edits after room creation; verify existing game/report snapshots preserve their original URL references and document that remote image bytes can change.
- [x] 3.4 Run mixed-format and legacy quiz API tests with an unreachable image URL; record compatibility/acceptance evidence and verify relevant suites, the API build, and architecture boundaries.

## Workflow follow-up

- Published issue tracking: [#60](https://github.com/CusmaLinux/robinhoot/issues/60) — 1.1–1.4 and 2.1–2.2; [#61](https://github.com/CusmaLinux/robinhoot/issues/61) — 3.1–3.4. See [issue map](../../../docs/mvp-issue-map.md) for blockers and classification. Issue creation does not complete these tasks.

- Review the implemented diff and acceptance evidence before archiving this change.
- Archive after API implementation/verification and documented contract handoff, then confirm its requirements are present in main specs; UI completion is tracked separately.
- Reconcile the next change against the resulting main specs before applying it.

- Link related UI issues in the separate repository once their real URLs are known; screen implementation, browser accessibility, and joint professor rehearsal are external product follow-up.

## Issue #60 implementation evidence (2026-10-27)

Tasks 1.1–1.4 and 2.1–2.2 are complete: 6/10 overall. Verified merged #59
at `d208635` with 199 unit / 142 integration / 133 e2e tests, build, types,
formatting, lint, strict specs and audit. Synced six requirements into main
`game-progression` and `game-results`, archived the complete predecessor as
`2026-10-27-finish-game-with-results`, and re-read the resulting main specs
before extending payloads. Archive links were adjusted for the deeper path.

One-test/minimal-implementation cycles verified hostable truth questions,
stale forward/reverse conversions, invalid persisted correct mappings, HTTP
save/reopen, safe truth labels, mixed report versions, and case-insensitive
question identity in conversions. Tests cover exact fixed UUID/text/order,
both correct choices, all supported durations, incomplete correctness/prompt/
duration and atomic rejection. Existing multiple-choice UUIDs remain valid.

Real HTTP plus independent Socket.IO clients play a mixed two-question game
with correct/wrong/missing answers, fixed cutoff, no early reveal, original
accepted receipt retries, fresh next-question duration and cumulative scores.
The version-2 report freezes original types/choices after source edits and
remains identical in owned history after deletion. Independent version-1 JSON
fixtures verify unchanged old quiz hosting/scoring and old report retrieval.
Swagger's mixed request/response example is executed against HTTP save/read.
See [the API/UI handoff](../../../docs/contracts/true-false.md), updated
[authoring architecture](../../../docs/architecture/quiz-drafts.md) and
[live architecture](../../../docs/architecture/live-question.md).

Final verification: 219 unit tests / 22 suites, 153 integration tests / six
suites and 135 e2e tests / two suites pass. API build, source/test TypeScript,
formatting, strict validation of all thirteen active/main OpenSpec items,
local documentation links and whitespace checks pass. Read-only ESLint has
zero errors and the two existing auth-test warnings. Database-backed checks
use only the dedicated `robinhoot_issue58_test` on loopback port 55458 with
explicit test credentials and JWT secret. No production data or migration
was used. Fallow audit against `origin/main` passes with zero introduced
dead-code, complexity, duplication, styling or diff-risk findings. Four
complexity findings are inherited; no suppression or gate change was added.
Architecture boundaries/policies remain unconfigured in Fallow; dependency
direction, framework-free domain rules and existing Symbol DI were reviewed
directly. No new providers or SQL migration are needed.

At the #60 checkpoint, image tasks 3.1–3.4 and archival remained pending for #61.
The image-dependent mixed acceptance evidence is recorded below.
UI implementation, merging and deployment are separate follow-up.

## Issue #61 implementation evidence (2026-10-27)

Tasks 3.1–3.4 are complete: 10/10 overall. Re-read the implemented predecessor
main specs and verified the archived full-game/results boundary and merged #60
before extending metadata. One-test/minimal-implementation cycles first exposed
HTTP rejection of valid metadata, acceptance of non-HTTPS URLs, unsafe persisted
reference readiness, missing safe live metadata and image-only version selection.
Each was corrected through the existing ports/adapters without fetching media.

HTTP checks cover verbatim save/reopen, syntactic URL failures, credentials,
non-HTTPS schemes, scalar/null rejection, URL/description bounds, omission removal
and the executable mixed Swagger example. An unavailable local HTTPS sentinel
receives zero TCP connections through save/room creation/start/submission/finish;
real host acknowledgement, guest broadcast and sync expose safe metadata without
answer keys. A mixed truth/multiple-choice game changes the same source question's
type/choices/image after room creation, then proves the original metadata/type
in gameplay and owned history after source deletion. Timing, exact cutoff,
receipts, scores and correct/wrong/missing counts retain their previous rules.
An image-only multiple-choice game emits version 2; independent legacy fixtures
still host and emit version 1 and old reports are returned without rewriting.
Committed image metadata survives source deletion and a fresh backend/pool.

Verification: 220 unit tests / 22 suites, 179 integration tests / six suites,
136 e2e tests / two suites pass. After the audit-driven projection/validation
refactor, rerun the unit suite and focused image/mixed/legacy/restart contract
checks. API build, source/test TypeScript, TypeScript formatting, read-only lint,
strict validation of all thirteen OpenSpec items, local documentation links and
whitespace checks pass. Lint retains only the two existing auth-test warnings.
Tests use the dedicated `robinhoot_issue58_test` database on loopback port 55458,
with explicit test credentials and secret. No production database or migration
was used. Fallow audit against `origin/main` passes with zero introduced findings;
four inherited complexity findings remain. No suppression or threshold changes.
Fallow architecture policies remain unconfigured; dependency direction,
framework-free rules, explicit safe projection and existing Symbol DI were
reviewed directly. No new provider, SQL migration or asynchronous round step.

The [metadata contract](../../../docs/contracts/question-images.md), executable
OpenAPI example and current architecture sequence describe the API/UI handoff:
optional fields, both report versions, unchanged round states, browser fallback
responsibility, and URLs frozen without remote bytes. UI implementation and
joint classroom rehearsal remain external follow-up. The combined API change
is ready for post-review specification sync and archival; it is left active
until that review. Merging and deployment are separate requests.
