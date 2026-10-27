# Optional question images — API/UI contract

Issue [#61](https://github.com/CusmaLinux/robinhoot/issues/61) adds image metadata
for both [question formats](true-false.md). The API validates, saves and returns
references. It never fetches, resolves, proxies, inspects or checks the reachability
of an image host. Question opening and answer acceptance use the existing server
clock regardless of image availability.

## Metadata

| Field | Contract |
| --- | --- |
| `imageUrl` | Optional string, at most 2048 UTF-16 code units, absolute HTTPS URL with a hostname and no credentials. |
| `imageDescription` | Optional plain-text description, at most 500 Unicode characters; an empty string is allowed. It may be supplied independently. |

Omit either field when unused. Explicit `null`, wrong scalar types, an empty URL,
malformed URLs, embedded credentials (including an empty user-info section),
non-HTTPS schemes, whitespace, control characters, backslashes, malformed percent
escapes and values beyond the bounds are rejected with HTTP 400 and the nested
field path. These are structural errors even in incomplete drafts; rejected saves
leave the previous content and timestamps intact. Persisted malformed metadata
also makes readiness false with `IMAGE_URL` / `IMAGE_DESCRIPTION` field errors.

The caps bound stored metadata and response size. Validation is syntactic only:
private/local hosts, signed query strings and fragments are allowed. Accepted
strings are retained verbatim, without URL normalization or description trimming.
`PUT /quizzes/:id` remains a full replacement: omitting previously saved fields
removes them from the source draft. Existing rooms/reports retain their copies.

## HTTP and Socket.IO examples

This complete question can be included in the ordered `questions` array of an
owned quiz alongside a four-option multiple-choice question. Use an account JWT
and the normal full-replacement authoring endpoint:

```json
{
  "title": "Cells with an optional diagram",
  "questions": [
    {
      "id": "10000000-0000-4000-8000-000000000002",
      "type": "true-false",
      "prompt": "All cells have a nucleus.",
      "imageUrl": "https://unreachable.invalid/cell.png?version=1#diagram",
      "imageDescription": "An animal cell with its nucleus labeled",
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

1. `POST /quizzes`, then `PUT /quizzes/:id` with this body. `GET /quizzes/:id`
   returns the same metadata. Swagger's executable `mixed` example includes both
   formats, one with an unreachable image and the other without metadata.
2. `POST /rooms` with the quiz ID and a fresh request ID. Bind the owner and join
   independent guests using the [existing walkthrough](game-progression.md).
3. `host.start` / `host.next` acknowledgements and `question.opened` broadcasts
   expose only the safe question fields. The example's public `question` has
   `id`, `type`, `prompt`, both image fields and its two labeled options. It has
   no `correctOptionIds`; those remain absent from the whole state until reveal.
   `state.sync`, restoration and `question.revealed` use the same projection.
4. Submit the option UUID through `answer.submit`. An unreachable image does not
   delay opening, change the deadline, prevent acceptance or alter scoring.
   Reveal and finish follow the existing clock, retry and ownership contracts.
5. `game.finished.report.quiz.questions` and owned `GET /reports/:id` / `GET /reports`
   preserve each question's original metadata. The report contains answer keys
   under the existing completed-report rules. Room creation metadata and lobby
   roster events do not expose unpublished questions or image fields.

For example, submitting `imageUrl: "https://teacher:secret@images.example/a.png"`
returns a field error such as:

```json
{
  "statusCode": 400,
  "message": ["questions.0.imageUrl must be an HTTPS URL of at most 2048 characters without credentials"],
  "error": "Bad Request"
}
```

## Snapshots, versions and UI handoff

Snapshots freeze URL and description strings at room creation. They do **not**
freeze, download or store remote image bytes. The host may change or delete those
bytes later. Source type, option or URL edits after hosting cannot alter a game
or its report; deleting the source or restarting the API cannot alter saved history.

New snapshots/reports use version 2 when they contain True/False or either image
field, including an image on a multiple-choice-only quiz. Plain multiple-choice
content without metadata still emits version 1. Readers return stored versions
unchanged and accept older questions/reports with both fields absent. No SQL
migration, discriminator backfill or metadata defaults are required. Rollback
must retain version-2 readers for already saved extended content.

The separate UI owns image loading, accessible descriptions/fallback, rendering
policy, allowed hosts, referrer policy and browser security. Treat descriptions
as plain text and use only trusted image content. The UI must let participants
answer on time when an image fails to load; it must not wait for media before
showing an open question. API acceptance and this contract handoff do not imply
that UI implementation or classroom rehearsal is complete.

## Executed acceptance paths

- [HTTP authoring](../../test/quiz.controller.spec.ts): save/read verbatim,
  URL and description bounds, malformed/credential-bearing/non-HTTPS field errors,
  removal on replacement, and executable mixed Swagger examples.
- [Real clients](../../test/lobby.gateway.e2e-spec.ts): an unavailable local HTTPS
  host receives zero TCP connections during authoring, opening and answer scoring;
  host acknowledgement, guest broadcast and sync carry safe metadata. A mixed
  game preserves the original URL/type/choices after source edits and deletion,
  with unchanged deadlines, reveal, retry receipts and correct/wrong/missing counts.
- [Report history](../../test/report.controller.spec.ts): committed metadata survives
  source deletion and a fresh backend/pool. OpenAPI documents optional fields;
  independent version-1 quiz/report fixtures remain playable/readable unchanged.
- [Domain readiness](../../src/quiz/domain/quiz.spec.ts): invalid stored references
  cannot be hosted or saved through the application boundary.

Reproduce with explicit test-only `DB_*` and `JWT_SECRET` values and a dedicated
migrated database whose name ends in `_test`: run `pnpm run test --runInBand`,
`pnpm run test:integration --runInBand`, `pnpm run test:e2e --runInBand`,
`pnpm run build`, source/test type checks and read-only lint.
