# Active game recovery — issue #56

This is the API handoff for the separate UI repository. Reuse the existing
[HTTP authoring setup](quiz-authoring-walkthrough.md), [live-question events](live-question.md),
and [restoration credentials](lobby-restoration.md). No new endpoint or payload
field is required. Acceptance tests in `test/lobby.gateway.e2e-spec.ts` use
injected room time with real HTTP, JWT, PostgreSQL, and Socket.IO clients.

## Returning guest

On a fresh socket send `session.restore {roomId,credential}`. The acknowledgement
`{ok:true,data:{roomId,playerId,credential,state}}` preserves player and nickname.
`state` includes roster, question, revision, phase, deadline, openedAt, serverNow,
millisecond units, own acceptedAnswer and own score. While open, score is zero
and correctness is absent. After reveal, the correct option and fixed
1000-or-zero score are included. An unanswered player gets acceptedAnswer:null.

Register events before restoration. Restore, `state.sync {roomId}`, and owner
`host.bind {roomId}` finish subscription before capturing the current snapshot.
Reveal during subscription, including a delayed timer callback, is settled
before acknowledging the current revision/result. Hosts receive no guest
receipt or choice; roster broadcasts contain only display identity/connection
status. Obsolete sockets cannot submit or read a receipt after replacement.

After acknowledgement loss, retry the complete original `answer.submit` payload.
Accepted retries return the original receipt even after reveal, with the original
acceptance revision, and never rescore. A new answer from an unanswered player
after closure fails `LATE_ANSWER`. Another ID from an answered player fails
`ALREADY_ANSWERED`; changed content under the accepted ID fails
`SUBMISSION_CONFLICT`. Failures do not mutate the result. Use snapshot revisions
for current state and receipt revisions as acceptance evidence. Treat
`lobby.roster` as a display update; request sync after missed events.

## Host return and cancellation

Host disconnect starts one fixed 120-second absence window. Question timing
continues, scores once, and remains at reveal while the host is absent. Owner
return uses `host.bind` with a freshly validated handshake `auth.token`.
Expired/revoked JWTs fail `UNAUTHORIZED`; valid foreign accounts fail `FORBIDDEN`.
Neither failure extends absence. Login again through `POST /auth/login`, connect
using the returned token, and bind before cutoff. Successful return preserves
question, deadline, revision and result. Host commands/sync revalidate JWTs.

At exactly 120000 ms of absence, cancellation wins over return even with delayed
callbacks. Guests receive `lobby.closed` with roomId, revision, phase:"closed"
and reason:"HOST_TIMEOUT". Restore, accepted answer retry, and valid owner return
then fail with `{ok:false,error:{code:"ROOM_CLOSED",message:"HOST_TIMEOUT"}}`
during the bounded closure-tombstone lifetime. Receipt and credential authority
is gone. Public host snapshots enforce this cutoff even while at reveal.

## Rehearsal transcript

IDs/tokens are aliases; times are elapsed room milliseconds from opening. JWT
expiry is real and independent of injected room time. The fixture's first option
is correct, known only to the authoring API before reveal.

| Time   | Request / event                         | Observed acknowledgement or state                           |
| ------ | --------------------------------------- | ----------------------------------------------------------- |
| 0      | Host binds; Alice/Bob join; host starts | Open revision 3, fixed deadline T+20000                     |
| 0      | Alice submits without callback          | Receipt committed at revision 4                             |
| 0      | Alice syncs                             | Own receipt revision 4; score 0; no correctness             |
| 0      | Alice disconnects and restores          | Same player; open revision 6; original receipt/deadline     |
| 0      | Bob syncs                               | acceptedAnswer:null, score 0; no Alice receipt              |
| 0      | Host and Alice disconnect               | Timer continues; roster revision 7                          |
| 20000  | Question deadline                       | Reveal revision 8; Alice scored 1000 once                   |
| 20000  | Alice restores                          | Reveal revision 9; same player/receipt/deadline; score 1000 |
| 20000  | Alice retries original answer           | Original receipt revision 4; no score change                |
| 20000  | Bob submits a new answer                | LATE_ANSWER                                                 |
| 20000  | Owner binds with expired signed JWT     | UNAUTHORIZED                                                |
| 20000  | Foreign authenticated account binds     | FORBIDDEN                                                   |
| 119999 | Owner logs in through HTTP and binds    | Public reveal revision 9; same roster; no receipt           |
| 120000 | Original cutoff passes                  | Still reveal; Alice score 1000; return cancelled absence    |

A separate fresh-round rehearsal leaves the host absent: one answer is accepted,
the question reveals, and expired-token bind at 119999 fails UNAUTHORIZED.
With callbacks withheld, valid owner bind at 120000 fails ROOM_CLOSED/HOST_TIMEOUT
and emits terminal closure. Original accepted answer retry and credential restore
then fail with the same reason. Three gated-subscription cases put reveal inside
restore, sync and host-bind subscription; acknowledgements include the current
revision and appropriate private guest or public host result.

The UI repository owns secret storage, countdowns, retry limits, stale-update
handling, reauthentication presentation and screens. This handoff requires no UI
implementation or external maintainer message.
