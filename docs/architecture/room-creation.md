# Owned room creation architecture

Implemented for [issue #50](https://github.com/CusmaLinux/robinhoot/issues/50).
See the [HTTP contract](../contracts/room-creation.md). Guest admission and
lifecycle work remain in the active `add-game-lobby` change.

## Components and dependencies

```mermaid
flowchart LR
  UI[Separate UI] --> HTTP[Authenticated RoomController]
  HTTP --> Create[CreateRoomUseCasePort]
  Create --> Service[CreateRoomService]
  Service --> Store[RoomStorePort]
  Service --> Reader[QuizSnapshotReaderPort]
  Store --> Memory[InMemoryRoomStore]
  Reader --> Adapter[OwnedQuizSnapshotReader]
  Adapter --> Quiz[QuizAuthoringUseCasePort]
  Quiz --> DB[(Owned saved quizzes)]
  Memory --> Snapshot[Frozen version-1 quiz snapshot]
```

RoomModule binds application ports through Symbols and imports only QuizModule's
exported authoring port. The cross-feature reader is an outbound adapter; the
room use case does not depend on quiz infrastructure, HTTP, or PostgreSQL.
Domain room types and errors have no framework imports. The existing application
layer convention permits Nest injection decorators in services. No auth guard,
quiz mutation rule, or database schema changes.

The singleton memory adapter owns room/owner/PIN indexes and per-owner pending
creation promises. Its `create` operation accepts a lazy snapshot loader so the
adapter can reserve an owner across asynchronous I/O, replay a successful
receipt without I/O, and release reservations in a `finally` block after failure.
It stores one receipt on the room, so retries do not grow a receipt collection.
`findById` and `findByPin` are internal ports, with no public HTTP read endpoint.
Returned internal aggregates and nested snapshots are frozen and copied at the
storage boundary. Only an explicit metadata projection crosses HTTP.

## Creation and retry sequence

```mermaid
sequenceDiagram
  participant UI as Separate UI
  participant HTTP as Auth and RoomController
  participant UseCase as CreateRoomService
  participant Store as InMemoryRoomStore
  participant Quiz as Owned quiz reader
  UI->>HTTP: POST /rooms with bearer token, quizId, requestId
  HTTP->>HTTP: Validate account and exact body
  HTTP->>UseCase: Create with verified owner ID
  UseCase->>Store: Create with lazy snapshot loader
  Store->>Store: Wait for pending creation for this owner
  alt Same successful request and quiz
    Store-->>UseCase: Existing frozen room
  else Another active request or conflicting quiz
    Store-->>UseCase: Conflict
  else No active room
    Store->>Quiz: Read owned quiz and readiness
    Quiz-->>Store: Valid snapshot or ownership/readiness error
    Store->>Store: Deep copy/freeze snapshot
    Store->>Store: Allocate unique PIN within 32 attempts
    Store->>Store: Atomically register room, owner, PIN, receipt
    Store-->>UseCase: Frozen room
  end
  UseCase-->>HTTP: Explicit safe metadata or typed error
  HTTP-->>UI: 201 metadata or documented error
```

PIN collision checks and registry publication have no await between them, so
two owners cannot interleave those operations in one process. Per-owner locking
prevents two awaited reads from creating two rooms. Errors commit no indexes;
source edits/deletion never reach the independent snapshot. Host authority
comes only from matching a reauthenticated account to private `host.ownerId`.

## Implemented creation state

```mermaid
stateDiagram-v2
  [*] --> NoRoom
  NoRoom --> Creating: Valid authenticated creation request
  Creating --> NoRoom: Lookup, readiness, or PIN allocation failure
  Creating --> Lobby: Frozen snapshot and unique PIN registered
  Lobby --> Lobby: Same owner/request/quiz replays original metadata
  Lobby --> Lobby: Other creation request rejected with 409
  Lobby --> Lobby: Source edited, reordered, or deleted
  Lobby --> [*]: API process stops
```

Only creation transitions are implemented here. Guest joining, explicit socket
host binding, reconnect, thirty-minute expiry, cancellation, and cleanup belong
to #51–#53. RoomStore will need lifecycle operations in that work; the creation
slice does not claim lifecycle acceptance or full-change archival. This single
process storage is intentionally unsuitable for multiple live-room replicas.
