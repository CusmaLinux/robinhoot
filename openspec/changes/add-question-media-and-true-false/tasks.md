# Tasks

Work one tested behavior at a time: failing test, minimal implementation, then refactor. All boxes are intentionally pending; planning does not complete implementation.

## 1. Extend the question format compatibly

- [ ] 1.1 Verify finish-game-with-results is implemented and archived; inspect actual persisted versions and update this design before changing payloads.
- [ ] 1.2 Write one failing True/False authoring behavior then extend the question union and hostability validation; verify two fixed choices, exactly one correct choice, and supported durations.
- [ ] 1.3 Test and implement API validation for question-type updates; verify stale option IDs or correct-choice mappings from the old type are rejected and document valid conversion payloads.
- [ ] 1.4 Add old quiz/report compatibility fixtures and only necessary additive migrations; verify existing multiple-choice content still loads, validates, and serializes correctly.

## 2. Carry True/False through a game

- [ ] 2.1 Test a True/False API round then extend snapshot/event payloads through existing option-ID handling; verify two labeled options and unchanged deadline, reveal, and scoring rules.
- [ ] 2.2 Extend report responses for question types and fixed choices; verify a mixed two-question game stores accurate snapshot content/counts and document the format contract.

## 3. Add optional image references

- [ ] 3.1 Test valid/invalid image references then add bounded HTTPS URL validation and API serialization without backend fetching; verify malformed, credential-bearing, and non-HTTPS references are rejected.
- [ ] 3.2 Document and test optional image metadata in host/report payloads; verify an unreachable image reference triggers no backend fetch or availability wait and does not block round opening or valid answers.
- [ ] 3.3 Test source image/type edits after room creation; verify existing game/report snapshots preserve their original URL references and document that remote image bytes can change.
- [ ] 3.4 Run mixed-format and legacy quiz API tests with an unreachable image URL; record compatibility/acceptance evidence and verify relevant suites, the API build, and architecture boundaries.

## Workflow follow-up

- Published issue tracking: [#60](https://github.com/CusmaLinux/robinhoot/issues/60) — 1.1–1.4 and 2.1–2.2; [#61](https://github.com/CusmaLinux/robinhoot/issues/61) — 3.1–3.4. See [issue map](../../../docs/mvp-issue-map.md) for blockers and classification. Issue creation does not complete these tasks.

- Review the implemented diff and acceptance evidence before archiving this change.
- Archive after API implementation/verification and documented contract handoff, then confirm its requirements are present in main specs; UI completion is tracked separately.
- Reconcile the next change against the resulting main specs before applying it.

- Link related UI issues in the separate repository once their real URLs are known; screen implementation, browser accessibility, and joint professor rehearsal are external product follow-up.
