# API and UI repository boundary

Robinhoot's API is implemented in this repository. The user already maintains the UI in a separate repository. Its location, framework, and current implementation have not been inspected here; no assumptions about them are required to implement the API.

## Responsibilities

| Concern | This API repository | Separate UI repository |
| --- | --- | --- |
| Authentication | Existing auth endpoints, token validation, authorization, and documented expiry/errors | Login screens, token storage, and reauthentication interaction |
| Quiz authoring | Private CRUD, ordering, draft/hostability validation, ownership, persistent content | Quiz editor, previews, controls, and field-error presentation |
| Live game | Room/PIN admission, session credentials, timing, state transitions, answers, scoring, and safe role-specific projections | Host/player screens, countdown display, controls, connection feedback, and stale-state handling |
| Results | Durable report snapshots, ranking, accuracy/count calculations, and owned report retrieval | Ranking display, charts, report history screens |
| Question formats | Stable type/choice identifiers and validated optional image URL metadata | Two/four answer controls, image rendering/fallback, and accessible presentation |
| Delivery | API process, PostgreSQL, HTTPS/WSS endpoint configuration, allowed UI origins, observability, and API workload checks | UI build, hosting, browser routing, responsive layouts, and accessibility tests |

The API supplies meaningful question/choice labels and explicit submission/phase/error data. Clients decide how to present them. Correct-answer secrecy, ownership, answer deadlines, and one-answer rules remain server-enforced regardless of client behavior.

## Contract handoff per change

Before implementing a capability, review its proposed public contract against any known UI integration needs. The UI framework and layout are not prerequisites for backend implementation. Unknown origin values are deployment configuration inputs, not reasons to invent a frontend package or routing scheme.

Each API change must deliver the contract documentation and verification relevant to its own behavior:

- REST operations in Swagger/OpenAPI, with authentication, example inputs/outputs, status codes, field errors, and ownership failures.
- Socket.IO event names, directions, request/acknowledgement/broadcast shapes, actor authorization, error codes, timing units, and sync/retry semantics. Swagger alone does not describe these events.
- Identifier, phase, revision, question-type, image-reference, ranking, and result-count semantics that the client must interpret consistently.
- API integration tests using HTTP and real Socket.IO clients where transport behavior matters. A Socket.IO client can be a development/test dependency here without creating a browser application.
- Known limitations and an example interaction transcript that the separate UI repository can use to integrate.

These are implementation deliverables, not claims that full endpoint/event schemas already exist. Keep the implemented contract documentation beside the relevant API feature and link it from its change. Avoid maintaining a second, conflicting specification in this boundary document.

## Use cases and diagrams

Professors and guest players remain the actors. Express API use cases as their requests and observable API outcomes: save a draft, host a room, join, submit, restore a session, and retrieve results. UI use cases and screens remain in the UI repository.

Proposed sequence, domain, state, and component diagrams belong in each change's design when useful. Show the UI as an external API consumer. Promote verified current architecture into `docs/architecture/` as implementation lands; archived change designs preserve historical decisions. Do not create empty diagram documents as a prerequisite for a feature.

## Issues, PRs, and completion

Create API issues and PRs here around complete API behaviors: transport, use case/domain, persistence when needed, contract documentation, and verification. Link related UI issues in the separate repository once their actual URLs are known. Do not invent repository names or links, or create combined UI/API implementation tasks in this repository.

An API change can be archived when its API requirements and tracked tasks pass verification and the contract handoff is documented. UI completion is not an API archival prerequisite. Reconcile the next API change with the resulting main specs before applying it.

The full professor pilot remains a joint product milestone. Screen behavior, real-device/browser accessibility, and an unaided professor rehearsal are UI/product follow-ups; API load tests do not establish that those checks passed.
