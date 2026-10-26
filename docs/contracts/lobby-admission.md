# Guest admission, restoration, and lobby rosters

Implemented for [#51](https://github.com/CusmaLinux/robinhoot/issues/51)
and [#52](https://github.com/CusmaLinux/robinhoot/issues/52),
`add-game-lobby` tasks 2.1–2.4, 3.1 and reconnect verification from 3.3.
Start with the authenticated
[room creation API](room-creation.md). See [architecture](../architecture/lobby-admission.md).
This is the contract handoff for the separately maintained UI repository.

## Connection and host binding

Use Socket.IO 4 on the API origin, default namespace `/`, default transport path
`/socket.io`. Both Engine.IO polling and WebSocket upgrade are supported.
Independent clients must use independent connections. Guest admission does not
require an account. A successful connection alone grants no room subscription
or host authority. The maximum incoming transport payload is 8192 bytes.

The host connects with `auth: {token: accessToken}` and emits `host.bind`:

```js
const host = io(apiOrigin, { auth: { token: accessToken } });
const receipt = await host.timeout(5000).emitWithAck('host.bind', {
  roomId: '52783943-0601-4716-8d62-46c6c890047a',
});
// {ok:true,data:{roomId,revision:0,phase:'lobby',roster:[]}}
```

Every `host.bind` verifies the account JWT signature, expiry, account existence,
and token version through the existing validator, then matches its user ID to
the room's private owner. Admin roles grant no ownership bypass. Client-supplied
owner IDs, PINs, socket IDs, and nicknames grant no host authority. A foreign
or unknown room returns the same `FORBIDDEN` error without revealing state.
A host is subscribed only after authorization. Update `host.auth.token` after
account reauthentication before binding again. HTTP controllers retain their
existing bearer-token protection.

## Guest admission and private acknowledgement

Emit `lobby.join` with exactly these three string fields:

```js
const guest = io(apiOrigin);
const requestId = crypto.randomUUID(); // retain for retries on this connection
const receipt = await guest.timeout(5000).emitWithAck('lobby.join', {
  pin: '004218',
  nickname: '  Alice  ',
  requestId,
});
```

A successful private acknowledgement has this shape (IDs and credential below
are illustrative; clients must use the issued values):

```json
{
  "ok": true,
  "data": {
    "roomId": "52783943-0601-4716-8d62-46c6c890047a",
    "playerId": "ec332e9e-df9a-43bd-9bb9-401fd1793300",
    "credential": "opaque-random-guest-secret",
    "state": {
      "roomId": "52783943-0601-4716-8d62-46c6c890047a",
      "revision": 1,
      "phase": "lobby",
      "roster": [
        { "playerId": "ec332e9e-df9a-43bd-9bb9-401fd1793300", "nickname": "Alice", "connected": true }
      ]
    }
  }
}
```

Keep the PIN as a six-digit string, including leading zeros. Request IDs must
be UUIDs and are normalized to lowercase. Nicknames are trimmed, contain 1–20
Unicode code points, and are unique within the room after `toLowerCase()`.
There are at most thirty joined guests; the host does not consume a guest slot.
Disconnected guests retain their identity, nickname, and slot.

After an acknowledgement timeout, retry the same PIN, UUID, and trimmed nickname
on the **same connection**. The retry returns the original player ID and secret
with the current safe state; it consumes no additional slot or revision, even
at capacity. Reusing that UUID with a different connection or nickname returns
`JOIN_REQUEST_CONFLICT`. One connection binds to one host or guest actor in one
room. It cannot switch actors or acquire a second guest identity.

The credential has 256 random bits, is stored as a SHA-256 verifier on its
room/player, and is returned only in that actor's private admission or restore acknowledgement.
A bounded receipt (one per guest, at most thirty per room) temporarily retains
the secret to replay that connection's admission. Disconnect clears the receipt's
plaintext secret while retaining the verifier. Replacement also clears that secret
and invalidates the admitting connection's receipt. Store the returned credential
privately; never publish it or treat request IDs as reconnect credentials.
Room credentials are never account bearer tokens. Rooms and credentials disappear
on API process restart. See [restoration and synchronization](lobby-restoration.md)
for complete reconnect examples and snapshot ordering.

## Safe roster event

Every successful join emits `lobby.roster` only to subscribed sockets in that
room, including the joining guest. Successful retries may repeat the current
snapshot. Disconnect changes that player's `connected` flag to false and emits
a new revision. Host binding returns the current snapshot without a mutation.

```json
{
  "roomId": "52783943-0601-4716-8d62-46c6c890047a",
  "revision": 2,
  "phase": "lobby",
  "roster": [
    { "playerId": "ec332e9e-df9a-43bd-9bb9-401fd1793300", "nickname": "Alice", "connected": true },
    { "playerId": "7952ee3a-cfcc-4f25-bd9f-bde61bbbcf2b", "nickname": "Bob", "connected": true }
  ]
}
```

These are the complete public state fields. No account identity, socket ID,
PIN, request ID, guest credential/verifier, quiz question, or answer key appears
in broadcasts. A private acknowledgement never contains another player's
credential. Treat snapshots as replacements; use `roomId` and monotonic
`revision` to discard stale or repeated state. Every admission, disconnect, or connection replacement increments revision once.
Restore retries on the current connection and state.sync do not increment revision.
Validation/authorization failures do not change membership, revision, or capacity.
An operation superseded while awaiting subscription fails with SESSION_REPLACED;
the later successful replacement owns the new revision and connection.

## Errors and attempt limits

Business and authentication failures use the acknowledgement callback:

```json
{ "ok": false, "error": { "code": "NICKNAME_TAKEN", "message": "Nickname is already in use" } }
```

| Code | Meaning / response |
| --- | --- |
| `INVALID_PAYLOAD` | Non-object, missing/extra/non-string fields, malformed UUID, PIN, or credential format; correct the request |
| `INVALID_NICKNAME` | Trimmed nickname is empty or exceeds twenty code points |
| `INVALID_PIN` | No room has this well-formed PIN |
| `NICKNAME_TAKEN` | Another request owns that case-insensitive nickname |
| `ROOM_FULL` | Thirty guests already joined |
| `ROOM_CLOSED` | The located room is outside the lobby phase |
| `JOIN_REQUEST_CONFLICT` | Receipt belongs to another connection or nickname; no secret is returned |
| `INVALID_CREDENTIAL` | No guest in the requested room matches the credential, including an unknown room |
| `SESSION_REPLACED` | Connection no longer owns this guest session; stop using the obsolete connection |
| `SESSION_ALREADY_BOUND` | Connection already has an incompatible room/actor binding |
| `ADMISSION_THROTTLED` | Attempt budget exhausted; wait for the sixty-second window to reset |
| `UNAUTHORIZED` | Missing, invalid, expired, or revoked host token; authenticate again |
| `FORBIDDEN` | Account does not own the room, or state.sync connection is unbound/targets another room |
| `INTERNAL_ERROR` | Unexpected failure; no internal error details or secrets are exposed |

Join and restore attempts share a budget, including malformed payloads, failures,
and successful retries. They are limited before payload validation or room lookup: ten per connection and
sixty per source address per fixed sixty-second window. Reconnecting retains
the source budget. Source entries expire lazily; the table holds at most 10,000
entries and rejects new sources while full. Connection entries are removed on
disconnect. Limits are configurable through the `ADMISSION_LIMITS` DI binding
in RoomModule; these are pilot defaults, not measured capacity claims. Source
identity uses the transport peer address, ignoring caller-supplied forwarded
headers. A reverse proxy therefore shares its source budget unless a separately
reviewed trusted-proxy policy is introduced.

`lobby.join`, `session.restore`, `state.sync`, `host.bind`, and `lobby.roster`
are published here. Owner cancellation, automatic expiry, and host absence timers remain in
[#53](https://github.com/CusmaLinux/robinhoot/issues/53); no public closure command
is introduced in this slice. The closed-room admission check is verified against
an internal closed state. Keep one API process for live rooms. No database
migration or UI implementation is included, and the OpenSpec change remains active.

## Verification

`test/lobby.gateway.e2e-spec.ts` runs independent Socket.IO clients against the
real Nest HTTP server, real JWT/account validation, HTTP quiz/room creation, and
a dedicated PostgreSQL test database. It checks host/two-guest consistency,
authentication/foreign hosts/revocation, retained HTTP protection, exact public
fields, private acknowledgements, independent room isolation, malformed inputs,
retries, request-ID theft, nickname/capacity errors, throttling, disconnects,
credential restoration, obsolete connection revocation, host sync revalidation,
and mutations during deliberately delayed restore/sync/host subscriptions.
Pure admission/limiter tests cover closed rooms and deterministic clock/budget
boundaries. Database names must end in `_test`; never run against production.

With explicit test-only `DB_*` and `JWT_SECRET` values configured:

```sh
pnpm exec jest --runInBand
pnpm exec jest --config test/jest-integration.json --runInBand
pnpm exec jest --config test/jest-e2e.json --runInBand
pnpm run build
```
