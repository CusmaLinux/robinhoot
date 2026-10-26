# Lobby closure and host return

Implemented for [#53](https://github.com/CusmaLinux/robinhoot/issues/53),
`add-game-lobby` tasks 3.2–3.3. Start with [HTTP room creation](room-creation.md),
[admission](lobby-admission.md), and [guest restoration](lobby-restoration.md).
These examples are the contract handoff for the separately maintained UI.

## Owner cancellation

Connect using a current account token and successfully `host.bind {roomId}`.
The bound host then sends exactly these two UUID string fields:

```js
const commandId = crypto.randomUUID();
const result = await host.timeout(5000).emitWithAck('host.cancel', {
  roomId,
  commandId,
});
// {ok:true,data:{roomId,revision:4,phase:'closed',reason:'OWNER_CANCELLED'}}
```

`host.cancel` revalidates the account token on every message (signature, expiry,
account existence, token version), then checks room ownership and the current
host connection. Guests receive `UNAUTHORIZED`; another authenticated account
or an unbound/wrong-room actor receives `FORBIDDEN`. A replaced host receives
`SESSION_REPLACED`. Extra fields, missing fields, invalid UUIDs, and non-string
values receive `INVALID_PAYLOAD`. Admin roles grant no ownership bypass.

Cancellation is terminal and idempotent for that owner. Retry with the same
command ID after an acknowledgement timeout. For five minutes, subject to the
1,000-closure global bound, retries return the original closure and revision
without emitting another event. Any command ID for that closed room has the same
terminal outcome; no command history or guest secret is retained. A retry from
after the room's expiry/host timeout returns that original terminal reason.
An owner returning on a new socket receives the closure through `host.bind`.

## Closure event

Install this listener before binding, joining, or restoring. Connected subscribed
participants receive `lobby.closed` before the server removes their room
subscriptions:

```json
{
  "roomId": "52783943-0601-4716-8d62-46c6c890047a",
  "revision": 4,
  "phase": "closed",
  "reason": "OWNER_CANCELLED"
}
```

| Reason | Trigger |
| --- | --- |
| `OWNER_CANCELLED` | Current authenticated owner cancels |
| `LOBBY_EXPIRED` | Thirty minutes elapsed since HTTP room creation |
| `HOST_TIMEOUT` | Current bound host remains disconnected for 120 seconds |

Closure increments the last room revision exactly once. Apply the same room ID
and monotonic revision rule as roster/state snapshots; a closure may arrive before
the cancellation acknowledgement. The event contains no roster, credentials,
account/connection identifiers, quiz content, or answer keys. Other rooms receive
nothing. TCP/Socket.IO connections remain open, but the room channel is removed.
The old actor binding remains until disconnect to prevent switching identities
on an obsolete connection.

Socket.IO delivery is live, not durable. A reconnect or operation awaiting its
subscription learns the terminal outcome via a private failure acknowledgement:

```json
{"ok":false,"error":{"code":"ROOM_CLOSED","message":"HOST_TIMEOUT"}}
```

`session.restore`, `state.sync`, and `host.bind` report `ROOM_CLOSED` with the
reason while the bounded tombstone exists. This error grants no restore or host
authority. After tombstone eviction/expiry (or process restart), guest restoration
returns `INVALID_CREDENTIAL`, and host binding returns `FORBIDDEN`. The released
PIN returns `INVALID_PIN` unless it has since been allocated to another room;
a PIN always addresses its current room, never an old identity.

## Host return and replacement

A freshly created room has the thirty-minute deadline even if no host ever binds.
The 120-second absence window starts when the current successfully bound host
socket disconnects. Disconnecting guests and obsolete host sockets cannot start
or extend it. Repeated disconnect callbacks cannot extend the deadline.

Reconnect with a current account token and emit `host.bind {roomId}` again.
Only the original owner can restore control. Return strictly before the absence
deadline cancels that absence timer and preserves room ID, PIN, roster, guest
credentials, and revision. Return at or after the deadline fails, even if the
scheduled callback has been delayed. Returning never extends the creation-based
thirty-minute deadline. If both deadlines have passed, the earlier deadline
selects the reason; creation expiry wins an exact tie.

There is one current host connection. A fresh authorized bind replaces the old
connection and removes its room subscription. The old socket cannot sync or
cancel, and its later disconnect cannot affect the replacement. Host state sync
revalidates the token and checks current connection authority without rebinding;
an obsolete pending bind cannot reclaim control after subscription completes.
A host can explicitly bind again with current account authentication.

The server deletes the live aggregate, guest verifiers, admission plaintext and
receipts, creation receipt/owner reservation, and PIN index on closure. Both
expiry and absence timers are cancelled. A small tombstone retains only owner
identity, closure payload, and expiry time for five minutes, globally capped at
1,000 entries (oldest evicted first, expired entries pruned on access/closure).
It contains no guest identity or credentials. A new room can reuse the owner and
PIN immediately; old callbacks target their original room/absence generation.
Application shutdown clears timers and tombstones. No database migration or
persistent live-room recovery is introduced.

## Verification and UI handoff

The fake-time application suite verifies terminal reasons, deadline boundaries,
repeated callbacks, host replacement, unchanged expiry on return, release of
room data/owner/PIN/timers, replacement-room isolation, tombstone expiry, and
shutdown. It runs the production timer adapter under Jest fake time.
The real Nest/Socket.IO suite uses independent host/two-guest clients, real JWT
and account checks, and a dedicated PostgreSQL database. Only the room runtime
port is controlled to exercise full 120-second/thirty-minute lifecycle behavior
without waiting; TCP and authentication run normally. Tests include isolation,
revoked credentials, malformed commands, delayed subscription races, and safe
closure delivery.

The UI repository owns closure presentation, account reauthentication, guest
secret disposal, reconnect handling, and monotonic event application. No UI work
or external maintainer message is included. Full API acceptance evidence is
recorded in the active change's tasks before a separate archival step.
