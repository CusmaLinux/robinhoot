# API readiness for the classroom pilot

## Why

A development demo is insufficient evidence that the live API supports the intended classroom workload. The separate UI needs a verified API deployment, stable integration contracts, and an explicit capacity envelope before the joint professor pilot.

## What Changes

- Prepare HTTPS/WSS API deployment of a single backend process and PostgreSQL, with configurable access from the actual UI origins.
- Verify API connection/session errors, the target classroom workload, and isolation across concurrent rooms using HTTP and Socket.IO clients.
- Provide API integration/operator instructions and contract examples; document the active-room restart limitation and separate UI/product pilot follow-ups.

## Capabilities

### New Capabilities

- `classroom-pilot`: Classroom API workload, external UI integration, and explicit session availability responses.

### Modified Capabilities

None. These additions compose with predecessor capabilities; recheck the main specs after predecessor archival before applying this change.

## Impact

Depends on add-question-media-and-true-false being implemented and archived. Affects API deployment configuration, origin handling, contract/workload tests, and operator/integration notes. UI hosting, browser/device accessibility, professor-facing instructions, and the unaided professor rehearsal belong to the UI/product workflow. API hosting target, UI origin values, and simultaneous classroom count remain deployment preflight inputs.

Affected people: API maintainer(s), maintainers of the separate UI repository as contract consumers, pilot professors, and participating students. No separate organizational teams are assumed.

Repository boundary: this change owns API behavior, contract documentation, and API verification. Track screen/rendering/client-storage work separately in the UI repository. See [API/UI boundary](../../../docs/api-ui-boundary.md). API archival depends on its API acceptance evidence and documented handoff, not UI implementation completion.

Existing patterns: follow AuthModule's application ports, Symbol DI bindings, boundary DTOs, and Kysely adapters. Retain the existing user/admin authentication model. See [MVP guide](../../../docs/mvp-development-guide.md).

## Dependencies and Review Gates

Implement and archive add-question-media-and-true-false first. These prerequisites are documented review gates; artifact readiness does not enforce cross-change ordering.

All six roadmap changes are drafted together at the user's request. Later drafts must be reconciled with implemented predecessor behavior before application. Numeric defaults are planning decisions to review, not measured performance claims.

## Rollback Plan

Close admissions and notify active participants before rolling back the deployment. Retain/back up quizzes and completed reports; do not imply active games can migrate between processes.
