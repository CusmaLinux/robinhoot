# Restoring a lobby session

Implemented for [#52](https://github.com/CusmaLinux/robinhoot/issues/52).
This extends the [admission contract](lobby-admission.md) for the separate UI
repository. HTTP room creation and account authentication are unchanged.

## Guest reload and replacement

Retain the admission acknowledgement's `roomId`, `playerId`, and `credential`
privately. On a fresh connection, emit exactly two string fields:

```js
const returningGuest = io(apiOrigin);
returningGuest.on('lobby.roster', applyState); // register before restore
const restored = await returningGuest.timeout(5000).emitWithAck('session.restore', {
  roomId: savedSession.roomId,
  credential: savedSession.credential,
});
if (restored.ok) applyState(restored.data.state);
```

Success uses the same private shape as admission:

```js
// {ok:true,data:{roomId,playerId,credential,state:{roomId,revision,phase,roster}}}
```

`playerId`, nickname, and roster slot remain the same, including at capacity.
Only the matching room's verifier authenticates the credential. The secret is
43 base64url characters containing 256 random bits. The acknowledgement returns
the supplied credential; restoration does not rotate it or retain new plaintext
receipts. Each actual connection replacement increments revision once. A retry
on the current connection returns the current state without another mutation.
A successful restore broadcasts only the safe state as `lobby.roster`.

A replacement can occur before the old connection disconnects. The old socket
is removed from the room subscription, cannot sync, cannot replay its admission
receipt, and cannot acquire another identity on that connection. Its eventual
disconnect cannot mark the replacement offline. A connection already bound to
another actor or room cannot switch identities. Possession of the valid secret
still permits restoration on a fresh connection; keep it private.

PINs, nicknames, socket IDs, request IDs, and payload player IDs grant no restore
authority. No account token is needed for guest restoration. Invalid or foreign
credentials and unknown rooms return the same failure without roster data:

```json
{"ok":false,"error":{"code":"INVALID_CREDENTIAL","message":"Invalid room credential"}}
```

Wrong shapes, extra/non-string fields, invalid UUIDs, or a malformed credential
return `INVALID_PAYLOAD`. UUIDs are normalized to lowercase. A recently closed room returns `ROOM_CLOSED` with its terminal reason while the
bounded closure tombstone exists; no credential can restore it. A bound actor switch returns
`SESSION_ALREADY_BOUND`. Join and restore share the admission attempt limits.
See [closure and host return](lobby-lifecycle.md) for closure reasons, credential cleanup, expiry, and host absence;
process restart currently loses all rooms and makes old credentials invalid.

## Bound state synchronization

After guest admission/restoration or authenticated host binding, emit exactly
`{roomId}` to request the current safe state and ensure subscription:

```js
const synced = await returningGuest.timeout(5000).emitWithAck('state.sync', {
  roomId: savedSession.roomId,
});
if (synced.ok) applyState(synced.data);
// {ok:true,data:{roomId,revision,phase:'lobby',roster}}
```

An unbound connection, or one targeting another room, receives `FORBIDDEN`.
A replaced guest receives `SESSION_REPLACED` and must stop using the old socket.
A bound host's handshake `auth.token` is validated again, including expiry,
account existence, token version, and ownership. Revoked host tokens return
`UNAUTHORIZED`; a prior successful bind is insufficient. A host reconnects by
using its current account token and `host.bind`, never a guest credential.

## Snapshot ordering

Admission, restoration, host binding, and sync complete the room subscription
before synchronously rechecking authority and capturing the current state.
A mutation during subscription is included in the snapshot. A later mutation
is delivered through the established subscription. If another restore wins
while subscription is pending, the superseded operation fails with
`SESSION_REPLACED` and removes its subscription; it cannot return stale authority.
This guarantee is scoped to the single API process and its synchronous room store.

Events can arrive before an acknowledgement. Install the roster handler first
and apply both acknowledgements and events with the same monotonic revision rule:

```js
let current;
function applyState(next) {
  if (next.roomId !== savedSession.roomId) return;
  if (current && next.revision <= current.revision) return;
  current = next;
  renderLobby(current); // UI repository responsibility
}
```

Never replace a newer event with an older acknowledgement. Snapshots are full
safe-state replacements, not patches. No correct-answer content, account IDs,
connection identifiers, credential verifiers, or other players' credentials are
included. Sync itself does not mutate revision or broadcast a roster.

## Verification and handoff

The real-client suite `test/lobby.gateway.e2e-spec.ts` exercises host/two-guest
reload, live replacement, obsolete socket actions/disconnects, cross-room and
identity-only rejection, malformed and guessed credentials, retries, actor binding,
shared attempt budgets, and host sync after logout. A delayed adapter deterministically
holds subscriptions open while another client joins or replaces a session, proving
restore/sync/host snapshots contain intervening mutations and receive later events.
Application tests additionally verify restoration at capacity and closed/unknown
rooms. These checks use only a dedicated database ending in `_test`.

The UI repository owns secret storage, reconnect presentation, and applying the
revision rule. No external maintainer message or UI implementation is included.
