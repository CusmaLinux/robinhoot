# Design

## Context

Apply after add-question-media-and-true-false is archived. This change verifies the API deployment, workload envelope, and availability/integration behavior in specs/classroom-pilot/spec.md. All capacity targets are hypotheses until exercised on the deployed environment.

## Goals / Non-Goals

Repository boundary: this is an API-only change. The existing UI is an external consumer maintained in another repository. See [API/UI boundary](../../../docs/api-ui-boundary.md) for contract handoff and completion responsibilities.

Goals: a reproducible single-instance API deployment and a demonstrated classroom API workload with usable integration documentation.
Non-goals: UI hosting/builds, browser routing, accessible screen implementation, public scale launch, distributed live state, or active-game restart recovery.

## Decisions

1. Deploy one Nest process and private persistent PostgreSQL behind an HTTPS/WSS endpoint. A TLS reverse proxy can forward REST and Socket.IO traffic; this repository does not serve frontend static assets. Choose configuration compatible with the actual API hosting target during preflight; no provider purchase or deployment is authorized by this plan. Keep the single-backend invariant explicit if the platform defaults to replicas.
2. Preserve existing REST paths and Swagger behavior. Configure the real UI origin allowlist, REST CORS, Socket.IO transport access, websocket upgrades, secrets, and SQL storage. Socket.IO CORS settings alone do not enforce websocket origin admission: validate browser origins during connection establishment as well. Origin controls complement account/session authentication rather than replacing it. Document intended behavior for API clients without an Origin header. Do not prescribe the UI's domain, routes, framework, or deployment topology.
3. Rehearsal target: one room with thirty guest clients. Also run three independent rooms with thirty guests each as a provisional concurrent target, adjusting documented capacity to real professor demand and measured resources before invitation. Use actual Socket.IO clients as test tools, not raw websocket frames. Check expected acknowledgements or explicit errors, deadline rejection, isolation, and correct reports. Record p95 acknowledgement latency against a provisional 500 ms healthy-network target, plus the environment, rather than treating the target as a measured claim.
4. Deliver HTTP/OpenAPI examples and live-event request/ack/broadcast transcripts covering identity, restoration, phase/revision, timing units, answer receipts, report data, and errors. Verify origin/auth handshakes with test clients sending configured/disallowed browser origins and REST preflight checks. Browser layouts, keyboard/screen-reader behavior, and actual-device testing belong to the separate UI repository.
5. A missing room returns SESSION_UNAVAILABLE for restore, sync, and answer requests. A room ID and credential must never restore a different room just because its PIN was reused. The UI owns stale-screen clearing and return-to-join navigation; API tests verify explicit errors and absence of accepted stale mutations. Completed history remains SQL-backed.
6. Add structured operational signals for room counts, join failures, disconnects, command rejection, and finalization errors without tokens or unnecessary personal data. Basic readiness/database connectivity checks and a non-production backup/restore rehearsal are sufficient; no new monitoring platform is required.
7. Deliver API operator/integration notes, including credential expiry, downtime, report/nickname retention, and the live-restart limitation. Track related UI issues once actual links are available. The professor guide, unaided classroom rehearsal, charts, and accessible interaction are separate UI/product deliverables.
8. API archival evidence includes API build, relevant suites on the dedicated test database, origin/auth contract checks, workload run, restore/restart behavior, and contract handoff. Record joint product/browser rehearsal as follow-up, not an unchecked API implementation task or a claim of product readiness.

## Risks / Trade-offs

- Test-client load does not reproduce every classroom network/browser condition → distinguish measured API capacity from the joint UI/device rehearsal.
- Single process limits availability → avoid deployments during class, communicate restart behavior, and retain SQL backups.
- Separate origins can block the existing UI → document environment-specific allowlists and test both HTTP and socket handshakes.
- Contract drift across repositories → provide examples and coordinate incompatible API changes with the UI maintainer.

## Migration Plan

Build API release artifacts and validate a staging configuration first. Apply additive database migrations, verify stored data, run the API workload/contract rehearsal, and hand off the integration details. Before rollback stop admissions and send closure reasons through existing events; restore a compatible API version while preserving SQL data. Active rooms are intentionally not migrated.

## UI/Product Follow-up

Coordinate the full product rehearsal using the separate UI deployment and actual classroom devices/network. API completion alone does not establish accessible screens or unaided professor use.
