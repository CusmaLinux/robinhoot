---
name: project-test
description: Run this repository's unit, integration, e2e, and coverage suites and suggest coverage improvements when the user requests a complete test review or the OpenCode /test equivalent.
---

Run the test review from the repository root with pnpm:

1. Run `pnpm run test --runInBand`.
2. Run `pnpm run test:e2e --runInBand`.
3. Run `pnpm run test:integration --runInBand`.
4. Run `pnpm run test:cov --runInBand`.

Inspect the integration and e2e setup before running database-backed suites. Use the configured test database; do not start services, apply migrations, or change database settings without authorization. If prerequisites are unavailable, report the affected suites as blocked and continue with independent suites.

Report each suite's result, relevant failures, and measured coverage. Suggest improvements based on uncovered behavior; do not edit code unless requested. `test:all` currently omits e2e, so it is not a substitute for this workflow.
