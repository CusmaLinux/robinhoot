# Two-account quiz authoring acceptance

Contract handoff for issue [#49](https://github.com/CusmaLinux/robinhoot/issues/49) and OpenSpec `add-quiz-authoring` tasks 4.1–4.3. Use the [quiz contract](quiz-drafts.md) and generated `/api-json` document for complete schemas. This API-only flow has no Socket.IO messages.

## Accounts and requests

Register two distinct accounts through `POST /auth/register` with `{ "email": "professor-a@example.com", "password": "TestPassword123!" }` and the same shape for `professor-b@example.com`. Each returns 201 with only `id` and `email`. Log in through `POST /auth/login` with those credentials; each returns 200 with its own `accessToken`. Use fresh test accounts and test-only passwords when replaying this flow.

All quiz requests below use `Authorization: Bearer <A accessToken>` unless the actor is B. JSON writes use `Content-Type: application/json`. `/api` is the documentation path, not an API prefix. Set the base URL to the API deployment or a local instance configured with a dedicated test database. Account tokens expire after fifteen minutes.

Create A's draft with `POST /quizzes` and `{}`. Expect 201, an empty question array, `hostable: false`, and field errors for title and question count. Record the returned quiz `id` as `Q`.

Save two questions with `PUT /quizzes/Q`:

```json
{
  "title": "Biology",
  "questions": [
    {
      "id": "10000000-0000-4000-8000-000000000001",
      "type": "multiple-choice",
      "prompt": "Which cell contains a nucleus?",
      "options": [
        { "id": "20000000-0000-4000-8000-000000000001", "text": "Animal" },
        { "id": "20000000-0000-4000-8000-000000000002", "text": "Bacterium" },
        { "id": "20000000-0000-4000-8000-000000000003", "text": "Virus" },
        { "id": "20000000-0000-4000-8000-000000000004", "text": "None" }
      ],
      "correctOptionIds": ["20000000-0000-4000-8000-000000000001"],
      "durationSeconds": 20
    },
    {
      "id": "10000000-0000-4000-8000-000000000002",
      "type": "multiple-choice",
      "prompt": "Which cell is eukaryotic?",
      "options": [
        { "id": "30000000-0000-4000-8000-000000000001", "text": "Animal" },
        { "id": "30000000-0000-4000-8000-000000000002", "text": "Bacterium" },
        { "id": "30000000-0000-4000-8000-000000000003", "text": "Virus" },
        { "id": "30000000-0000-4000-8000-000000000004", "text": "None" }
      ],
      "correctOptionIds": ["30000000-0000-4000-8000-000000000001"],
      "durationSeconds": 20
    }
  ]
}
```

Expect 200 with the submitted title/questions, generated quiz timestamps, `hostable: true`, and `errors: []`. For the next full PUT body, change the title to `Biology revision`, change question 1's prompt to `Which cell has a membrane-bound nucleus?`, and swap the two question objects so question 2 comes first. Retain every question/option UUID and send only `{ title, questions }`, excluding server-generated response fields. Expect 200 with the edited prompt and order `[question 2, question 1]`, `hostable: true`, and `errors: []`.

## Isolation, reopen, and deletion transcript

| Actor | HTTP request | Expected result |
| --- | --- | --- |
| A | `GET /quizzes/Q` | 200, exact last saved detail including order, identities, and timestamps |
| A | `GET /quizzes` | 200, summary for Q with `questionCount: 2` and `hostable: true` |
| B | `GET /quizzes` | 200, `[]` for a fresh B account |
| B | `GET /quizzes/Q` | 404, generic missing-quiz error |
| B | `PUT /quizzes/Q` with `{ "title": "Foreign edit", "questions": [] }` | 404, no mutation |
| B | `DELETE /quizzes/Q` | 404, no mutation |
| A | `GET /quizzes/Q` | 200, exact same detail and timestamps as before B's attempts |
| A | `DELETE /quizzes/Q` | 204, empty response body |
| A | `GET /quizzes/Q` | 404 |
| A | `GET /quizzes` | 200, `[]` if Q was A's only quiz |
| A | `DELETE /quizzes/Q` again | 404 |

The 404 body is always `{ "statusCode": 404, "message": "Quiz not found", "error": "Not Found" }`. An admin token belonging to another account gets the same denial; admin status does not transfer ownership. Clients must handle 204 without attempting JSON parsing.

Deletion removes the source quiz only. Live games and completed reports are not implemented at this stage; their future independent snapshots must survive source deletion. No game/report lifecycle action or Socket.IO broadcast is triggered here.

## Automated acceptance and handoff

The real HTTP/PostgreSQL test `completes the two-question authoring walkthrough with a private second account boundary` in `test/quiz.controller.spec.ts` exercises this sequence with generated UUIDs and two fresh accounts. Separate tests cover A's listing, admin denial with unchanged content/timestamps, missing/repeated IDs, malformed UUIDs, missing/invalid/expired/revoked credentials, empty 204 responses, and deletion observed by a second app/database pool. OpenAPI deletion success/error documentation is checked against actual transport responses.

To reproduce after migrating a dedicated database whose name ends in `_test`, supply its `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and test-only `JWT_SECRET`, then run:

```sh
pnpm run test:integration --runInBand quiz.controller.spec.ts
```

Handoff deliverables are this walkthrough, the [current quiz contract](quiz-drafts.md), and the generated Swagger/OpenAPI operations and examples. The UI maintainer can integrate the complete authoring flow from those artifacts. No external repository, message delivery, UI implementation, browser rehearsal, or deployment is claimed by this API acceptance.
