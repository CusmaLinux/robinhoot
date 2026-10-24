# Private draft create/list/read architecture

Implemented scope: [issue #47](https://github.com/CusmaLinux/robinhoot/issues/47). See the [public contract](../contracts/quiz-drafts.md). Editing and deletion are later slices.

```mermaid
flowchart LR
    UI[Separate UI repository] --> Controller[Quiz HTTP controller and DTO]
    Guard[Existing JWT and role guards] --> Controller
    Controller --> InPort[Quiz authoring Symbol port]
    InPort --> Service[Quiz authoring application service]
    Service --> Rules[Draft readiness domain rules]
    Service --> OutPort[Quiz repository Symbol port]
    Adapter[Kysely adapter] -. implements .-> OutPort
    Adapter --> DB[(PostgreSQL quizzes)]
```

The composition root binds both Symbol ports in `QuizModule`, imported by `AppModule`. Domain types/readiness have no NestJS or Kysely imports. The application sees verified owner IDs and repository contracts; request objects and database rows stay in adapters. The outbound adapter maps rows explicitly, so owner IDs cannot leak into response objects. Every read/list query includes the verified owner predicate. There is no role-based ownership bypass.

```mermaid
sequenceDiagram
    participant UI as External UI
    participant Auth as Existing JWT guard
    participant HTTP as Quiz controller
    participant App as Authoring service
    participant DB as PostgreSQL adapter
    UI->>Auth: POST /quizzes + bearer token + optional title
    Auth->>Auth: Verify signature, expiry, account and token version
    Auth->>HTTP: Verified account identity
    HTTP->>HTTP: Validate title and reject unknown fields
    HTTP->>App: create(verified ownerId, title)
    App->>DB: Insert owned draft with empty questions
    DB-->>App: Persisted draft and generated ID/timestamps
    App-->>UI: 201 detail + hostable false + field errors
    UI->>HTTP: Later GET /quizzes/id (same authentication)
    HTTP->>App: read(verified ownerId, id)
    App->>DB: Find by ownerId AND quiz ID
    alt Owned quiz exists
      DB-->>App: Saved aggregate
      App-->>UI: 200 detail + derived readiness
    else Missing or foreign quiz
      DB-->>App: No match
      App-->>HTTP: null
      HTTP-->>UI: 404 Quiz not found
    end
```

```mermaid
stateDiagram-v2
    [*] --> SavedIncompleteDraft: authenticated create
    SavedIncompleteDraft --> SavedIncompleteDraft: read or list
    note right of SavedIncompleteDraft
      Readiness is derived, not stored.
      Blank title: title REQUIRED.
      Zero questions: QUESTION_COUNT.
      Editing/hostable transition belongs to issue 48.
    end note
```

The aggregate is a single row: generated UUID, owner UUID referencing `users`, a title capped at 200 characters, empty JSONB questions, and creation/update timestamps. No in-memory draft cache exists. A dedicated database integration test proves that an independently constructed app with its own database connection can reopen committed content.

Kysely's `FileMigrationProvider` loads migration files by directory at runtime. `.fallowrc.json` declares that directory as an entry point so static analysis recognizes these database lifecycle exports without adding artificial imports or hiding dead-code rules. The CI audit installs project dependencies before analysis to avoid degraded dependency resolution.
