# Owned room creation

Issue [#50](https://github.com/CusmaLinux/robinhoot/issues/50), OpenSpec
`add-game-lobby` tasks 1.1–1.4. This slice creates rooms; [guest admission and Socket.IO host binding](lobby-admission.md) are implemented in #51. Reconnect, expiry, and cancellation follow in #52–#53.
See the [implemented architecture](../architecture/room-creation.md).

## Create and recover an acknowledgement

`POST /rooms` requires `Authorization: Bearer <accessToken>` from the
[account API](authentication.md). Regular users and admins can host only their
own [hostable quizzes](quiz-drafts.md). Admin status grants no ownership bypass.
The body must be an object containing exactly two UUID strings:

```json
{
  "quizId": "d65ae15c-a1d9-42ce-a328-104d2eebd8f1",
  "requestId": "a9befeed-6bee-4bde-83c8-0e73961e223d"
}
```

Generate a request UUID once for a creation attempt and retain it until the
acknowledgement is received. Reuse both IDs after an HTTP timeout. UUIDs are
normalized to lowercase. Do not send owner identity, host credentials, question
content, answer keys, or a requested PIN. Unknown properties receive 400.

HTTP 201 (including successful replay):

```json
{
  "roomId": "52783943-0601-4716-8d62-46c6c890047a",
  "pin": "004218",
  "phase": "lobby",
  "revision": 0,
  "createdAt": "2026-10-25T16:00:00.000Z"
}
```

Keep PINs as strings: leading zeros matter. A PIN has exactly six decimal digits
and is unique among active rooms in this process. The response contains only
room identity, PIN, phase, revision, and creation time; it contains no quiz
content, correct answers, owner/account data, or session credentials.

The server privately binds `host.ownerId` to the authenticated user ID and keeps
the original request ID on the room. Neither the PIN, room ID, nor request ID
is host authentication. Subsequent host commands must authenticate the account
again and compare it with that private owner binding. Socket host binding now uses the same account token through `host.bind`; see
the [admission contract](lobby-admission.md).
The UI should retain its existing account credential and the safe room metadata.

One owner can have only one active room. The same owner/request/quiz tuple
returns exactly the original response while that room exists, even after the
source is edited or deleted. Reusing the successful request ID for another quiz
returns 409. A different request ID also returns 409 while the owner has a room.
Different owners have independent request-ID namespaces. Authentication is
checked before every replay, including expiry and token revocation.

Creation is serialized per owner across the awaited quiz read. Different owners
can create independently. After reading a valid snapshot, PIN allocation and all
registry writes execute together without yielding. Collisions retry at most 32
times and never overwrite a registered PIN. Lookup, validation, or allocation
failure leaves no room, owner reservation, or successful receipt; retry the same
request after resolving the failure.

## Snapshot boundary

Creation reads the owner-scoped quiz once and rejects incomplete content using
the existing derived readiness rules. It copies the title, ordered questions,
ordered options, stable IDs, answer mappings, and durations into a deeply frozen
version-1 snapshot. Internal snapshots retain answer keys for future game use;
they are never returned in creation metadata. Saving, reordering, or deleting the
source does not change that snapshot. There is no room-to-quiz database foreign
key or cascade.

Rooms, owner indexes, PIN indexes, and one successful creation receipt per room
live in memory in a single API process. Restart loses them. No cross-process
uniqueness or recovery is promised. Expiry/cancellation and cleanup are pending
#53; this creation slice retains rooms until process shutdown. Do not deploy
multiple replicas for shared live rooms. No database migration is required.

## Errors

| HTTP | Code | Trigger / client action |
| --- | --- | --- |
| 400 | Standard validation response | Missing/malformed UUID, unknown property, or non-object body; fix input |
| 400 | `QUIZ_NOT_HOSTABLE` | Owned incomplete draft; show field errors, edit source, retry |
| 401 | Existing account auth response | Missing, invalid, expired, or revoked token; authenticate again |
| 404 | `QUIZ_NOT_FOUND` | Missing or foreign source, identical for users/admins |
| 409 | `OWNER_HAS_ACTIVE_ROOM` | A different creation request for an owner with a room |
| 409 | `CREATION_REQUEST_CONFLICT` | Successful request ID reused with a different quiz |
| 503 | `PIN_ALLOCATION_EXHAUSTED` | 32 collisions; retry the same request |

An empty draft returns:

```json
{
  "statusCode": 400,
  "code": "QUIZ_NOT_HOSTABLE",
  "message": "Quiz is not hostable",
  "fields": [
    { "field": "title", "code": "REQUIRED", "message": "Title is required" },
    { "field": "questions", "code": "QUESTION_COUNT", "message": "Quiz must contain 1–20 questions" }
  ]
}
```

Other business errors use the same `statusCode`, `code`, and `message` shape,
without `fields`. For example:

```json
{
  "statusCode": 409,
  "code": "OWNER_HAS_ACTIVE_ROOM",
  "message": "Owner already has an active room"
}
```

## API/UI handoff and verification

Use the existing authoring flow to save a ready quiz, POST the example with its
real quiz ID and a fresh request UUID, and display the returned string PIN.
Retry the exact request after a lost acknowledgement. Editing/deleting the
saved quiz affects future games only. UI implementation and session storage
remain in the separate repository; this document and generated OpenAPI at
`/api` provide the handoff, without an external maintainer message.

The HTTP/PostgreSQL suite covers creation, safe output, frozen content/order
after edit/delete, private host identity, readiness rejection and recovery,
foreign user/admin and missing quizzes, active-room conflicts, request-ID
conflicts, simultaneous retries, distinct concurrent requests, malformed input,
auth failures, and generated OpenAPI parity. Concurrent HTTP tests use committed
fixtures through an independent app/pool, then explicitly remove test records.
Deterministic registry tests cover delayed reads, allocation collisions and
exhaustion, failed-lookup recovery, owner independence, and defensive copying.

Run database-backed checks only with explicitly configured `DB_*` variables
pointing to a dedicated database whose name ends in `_test`, plus a test-only
`JWT_SECRET`. Apply the existing migrations, then run
`pnpm run test:integration --runInBand room.controller.spec.ts`. Pure registry
checks run with `pnpm run test --runInBand in-memory-room.store.spec.ts`.
