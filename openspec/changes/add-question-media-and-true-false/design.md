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
