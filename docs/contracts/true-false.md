# True/False questions — API/UI contract

Issue [#60](https://github.com/CusmaLinux/robinhoot/issues/60) extends the
[quiz authoring](quiz-drafts.md), [gameplay](live-question.md) and
[owned reports](report-history.md) contracts. [Optional images](question-images.md) are covered by issue #61.

## Authoring and conversion

`PUT /quizzes/:id` still replaces the entire ordered draft with an account JWT.
`type` accepts `multiple-choice` or `true-false`. True/False has exactly these
two choices in this order, with exact text and stable UUIDs shared across truth
questions. Question IDs remain distinct UUIDs. Either choice can be correct.

```json
{
  "title": "Cells",
  "questions": [
    {
      "id": "10000000-0000-4000-8000-000000000001",
      "type": "true-false",
      "prompt": "All cells have a nucleus.",
      "options": [
        { "id": "00000000-0000-4000-8000-000000000001", "text": "True" },
        { "id": "00000000-0000-4000-8000-000000000002", "text": "False" }
      ],
      "correctOptionIds": ["00000000-0000-4000-8000-000000000002"],
      "durationSeconds": 10
    }
  ]
}
```

A hostable question needs a nonempty prompt, exactly one correct choice, and a
duration of 10, 20, 30 or 60 seconds. Blank prompts, zero/two correct choices or
unsupported durations can be saved as incomplete drafts. The response returns
`hostable:false` and field errors; `POST /rooms` rejects them with HTTP 400
`QUIZ_NOT_HOSTABLE`. Wrong truth IDs/text/order, duplicate IDs and dangling
correct references are structural HTTP 400 errors; the saved draft is unchanged.
`OPTION_MAPPING` and `CORRECT_OPTION_MAPPING` also identify invalid persisted
mappings in readiness checks, preventing them from becoming hostable.

For conversion, keep the question ID and replace `type`, `options` and
`correctOptionIds` together. Converting multiple-choice to True/False uses the
payload above. Converting back supplies four nonempty options with new UUIDs
and one of those UUIDs as the correct ID. Reusing that question's previous
choice IDs across a type change is rejected, even if the submitted correct ID
still references one of them. The server reads the prior owned draft through
the existing repository port and never guesses which replacement is correct.
Existing multiple-choice IDs remain valid; the new fixed truth IDs do not
retroactively invalidate an old multiple-choice quiz. Saves retain existing
last-write-wins concurrency semantics.

Swagger includes a tested `mixed` PUT request/response example with one question
of each type. Add questions to the same array to create a mixed game; existing
question/option ordering and owner-only access remain unchanged.

## Socket.IO opening, answers and results

Use the existing HTTP room creation and `host.bind` / `lobby.join` setup from
[the progression walkthrough](game-progression.md). `host.start` and `host.next`
return safe question states and broadcast `question.opened`. A truth opening's
`question` contains:

```json
{
  "id": "10000000-0000-4000-8000-000000000001",
  "type": "true-false",
  "prompt": "All cells have a nucleus.",
  "options": [
    { "id": "00000000-0000-4000-8000-000000000001", "label": "True", "text": "True" },
    { "id": "00000000-0000-4000-8000-000000000002", "label": "False", "text": "False" }
  ]
}
```

Multiple-choice retains four options labeled `A`, `B`, `C`, `D`. Correct IDs
stay absent until reveal for both types. Submit the chosen UUID, not a Boolean:

```javascript
const receipt = await guest.timeout(2000).emitWithAck('answer.submit', {
  roomId,
  questionId: opened.questionId,
  submissionId: crypto.randomUUID(),
  optionId: '00000000-0000-4000-8000-000000000002',
});
```

Question ID scopes the answer even when truth UUIDs repeat in later questions.
The shared engine preserves the original deadline after submissions, accepts
new answers strictly before the monotonic cutoff, returns original receipts on
identical retries, reveals once, and awards 1000 points for correct answers and
zero for wrong/missing answers. Next/finish authorization and retry rules are
unchanged. Restoration uses the same safe question projection.

## Persistence, versions and compatibility

Quiz rows continue storing their existing JSONB questions arrays without a SQL
migration. Every pre-extension question already had a discriminator, so readers
do not invent missing types or rewrite stored data. Multiple-choice-only room
snapshots and reports without image metadata remain version 1. A snapshot
containing True/False or optional image metadata is version 2, and its completed report has `version:2` and `quiz.version:2`.
History returns both versions unchanged; consumers must understand the new
discriminant before enabling extended authoring.

`report.quiz.questions` retains original types, prompts, choices, correct IDs
and durations. Count facts join by `questionId`; ranking, eligibility, percentage
accuracy, ownership and ten-minute room cleanup keep their existing semantics.
Source edits after room creation cannot change the game. Edits/deletion after
completion cannot change history. Stored reports remain independent of source
lookups and live rooms. Rollback can disable extended creation but must retain
version-2 readers for existing reports/quizzes.

## Acceptance evidence and handoff

- [Domain tests](../../src/quiz/domain/quiz.spec.ts) cover fixed identity/text/order,
  valid durations, missing correctness, stale IDs and legacy UUID compatibility.
- [HTTP tests](../../test/quiz.controller.spec.ts) cover persistence, atomic
  conversion rejection, valid conversions in both directions, unhostable drafts
  and executable OpenAPI examples.
- [Real-client tests](../../test/lobby.gateway.e2e-spec.ts) play mixed rounds with
  correct/wrong/missing answers, exact cutoff, receipt retries, fresh deadlines,
  source edits/deletion and original snapshots in owned history. They also play
  an unchanged legacy quiz through a version-1 report.
- [History tests](../../test/report.controller.spec.ts) reopen the independent
  [version-1 fixture](../../test/fixtures/legacy-report-v1.json) without rewriting it.

The separate UI owns type-switch controls, rendering two/four answer buttons,
and handling both report versions. This document and Swagger are the API handoff;
UI implementation remains separate follow-up.
