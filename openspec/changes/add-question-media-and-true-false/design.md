# Design

## Context

Apply after finish-game-with-results is archived. Read actual quiz and report document versions before extending them. See specs/quiz-question-formats/spec.md; the earlier multiple-choice requirements continue to apply to multiple-choice questions.

## Goals / Non-Goals

Repository boundary: this is an API-only change. The existing UI is an external consumer maintained in another repository. See [API/UI boundary](../../../docs/api-ui-boundary.md) for contract handoff and completion responsibilities.

Goals: extend existing question discriminants, validators, and public payloads consistently.
Non-goals: file upload, backend media fetching, answer images, video, or rewriting the live engine.

## Decisions

1. Extend the question union with true-false using fixed stable true/false option IDs and exactly one correct ID. Both types share prompt, duration, and optional imageUrl. Preserve generic option-ID answer acceptance and fixed scoring; do not branch the engine into two timing implementations.
2. Keep existing snapshots without imageUrl valid. Default legacy questions to their existing multiple-choice type only where old stored format lacks a discriminator. Version new aggregate/report documents and keep old readers covered by fixtures. Use additive migrations only if the actual prior storage schema requires them.
3. Validate image references as bounded HTTPS URLs without embedded credentials. Store and return references without backend fetch/proxy/metadata lookup or reachability checks. The API cannot guarantee remote bytes remain available or unchanged. Image security policy, request referrers, rendering, and fallback belong to the separate UI repository.
4. Include optional imageUrl and a short optional image description in authoring/report responses and safe question payloads. Remote image availability must not participate in server timing or answer acceptance. Document the metadata and its optionality so the UI can choose accessible fallback presentation.
5. Validate creation/updates per question type, including type changes. Require the submitted option/correct-answer mapping to match the new type; reject stale choice identities rather than silently retaining correctness from the old type. The UI owns its type-switch controls. Do not modify already-created game snapshots.
6. Reuse the existing host/guest projection rules: imageUrl and question type are public at opening, correct-option metadata remains hidden until reveal. Return two fixed labeled options for True/False and four for multiple choice; the UI owns answer control rendering.
7. External hosts receive browser requests and may remove or alter images. Proposed MVP choice is URL references, reviewed before pilot invitation. If this is unacceptable, replace this design with a scoped upload/storage change before implementation rather than adding an unplanned image proxy.

## Risks / Trade-offs

- External image availability/content drift → API never waits for remote images; document the UI fallback dependency and that report snapshots freeze the URL, not remote bytes.
- Mixed payload version drift → compatibility fixtures for old quizzes/reports and a full mixed-game API contract check.
- Unsafe type conversion → reject inconsistent choice mappings at the API boundary and domain validation before hosting.

## Migration Plan

Deploy tolerant API readers first, then enable new question creation and publish updated contract examples for the UI repository. Test existing quizzes and reports before enabling creation. Rollback disables new mixed authoring but retains compatible readers; do not revert to a reader unable to handle saved mixed content.

## Predecessor reconciliation — issue #60 (2026-10-27)

Verified merged #59 at `d208635`: 199 unit, 142 integration and 133 e2e
tests; build, source/test types, formatting, read-only lint and strict spec
validation pass. Synced six progression/results requirements and archived
`finish-game-with-results` as `2026-10-27-finish-game-with-results`, then
re-read the resulting main specs before extending payloads.

Quiz rows contain an unversioned JSONB questions array; every existing
question already has `type: multiple-choice`. No discriminator backfill or SQL
migration is needed. Existing snapshots and reports are version 1. Mixed/True/False
snapshots and reports use version 2; unchanged multiple-choice games continue
to emit version 1. Readers accept both without rewriting stored documents.

True/False choices are ordered True, False with stable UUIDs
`00000000-0000-4000-8000-000000000001` and
`00000000-0000-4000-8000-000000000002`. These preserve existing UUID boundary
validation and generic option-ID submission. Fixed text and order are structural;
invalid mappings are rejected atomically on save and cannot become hostable.
Missing prompt, correctness or supported duration remain readiness errors.
Full replacement conversions must submit the new format's choices and explicit
correct ID. A type conversion for the same question ID rejects reuse of its
previous choice IDs. Existing multiple-choice UUIDs remain valid even if they
coincide with the new truth IDs; the conversion check uses the owned prior draft.

The agreed #60 contract covers tasks 1.1–1.4 and 2.1–2.2. Timing, scoring,
accepted receipts, ownership and report storage keep their existing paths.
Image fields and tasks 3.1–3.4 remain #61; do not archive this combined change
until that work and its API handoff are verified.

## Media reconciliation — issue #61 (2026-10-27)

Re-read the actual main quiz-authoring, live-gameplay, game-progression and
game-results specs and verified that the predecessor full-game/results change
is archived. Issue #60 is merged at `82b6db6` with its first six tasks complete.

Optional `imageUrl` is bounded to 2048 UTF-16 code units and checked with a
framework-free predicate shared by HTTP validation and domain structure/readiness.
Require explicit HTTPS syntax, a nonempty authority/hostname, no user-info,
whitespace/control characters, backslashes or malformed percent escapes. Do not
resolve DNS or fetch remote content. Preserve accepted strings verbatim, including
queries and fragments. The optional plain-text `imageDescription` permits up to
500 Unicode characters, including an empty string; it may exist independently.
Omitted fields are absent in legacy payloads; explicit null is invalid. Full
replacement saves remove omitted source metadata without changing snapshots.

The existing JSONB question array and report document need no migration. Extend
the existing version-2 snapshot/report shape for truth or either metadata field;
plain multiple-choice without metadata remains version 1. Readers preserve stored
versions. No new DI bindings, ports, async round operations or media availability
states are needed. The safe live projection selects metadata explicitly, keeping
answer keys private until reveal. Frozen strings survive source edits/deletion
and backend restart; remote bytes remain mutable and are never stored.

See [the metadata contract](../../../docs/contracts/question-images.md) for HTTP,
Socket.IO, version compatibility and UI rendering/fallback handoff. Updated
architecture diagrams retain existing round transitions and show the metadata
flow through authoring, snapshots, live projections and saved reports.
