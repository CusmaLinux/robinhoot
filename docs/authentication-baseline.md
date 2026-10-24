# Authentication baseline reconciliation

Issue: [#46](https://github.com/CusmaLinux/robinhoot/issues/46). Application baseline inspected: commit `61ec9c7`.

This document reconciles the two archived authentication changes with current source and verification. The six main specs describe existing behavior; the six active MVP changes remain proposals for future behavior. No application code, migration, or historical archive content is changed by this reconciliation.

## Main specs and evidence

| Capability | Current implementation evidence | Existing test evidence |
| --- | --- | --- |
| [user-auth](../openspec/specs/user-auth/spec.md) | [controller](../src/auth/infrastructure/adapters/in/auth.controller.ts), [registration](../src/auth/application/services/register.service.ts), [login](../src/auth/application/services/login.service.ts), [logout](../src/auth/application/services/logout.service.ts) | [HTTP integration](../test/auth.controller.spec.ts), service unit tests |
| [jwt-access-token](../openspec/specs/jwt-access-token/spec.md) | [module signing configuration](../src/auth/infrastructure/auth.module.ts), [bootstrap](../src/main.ts), [JWT adapter](../src/auth/infrastructure/adapters/out/jwt-nestjs.adapter.ts) | [JWT adapter](../src/auth/infrastructure/adapters/out/jwt-nestjs.adapter.spec.ts), [login](../src/auth/application/services/login.service.spec.ts), normal-bootstrap checks described below |
| [jwt-guard](../openspec/specs/jwt-guard/spec.md) | [HTTP guard](../src/auth/infrastructure/adapters/in/jwt-auth.guard.ts), [public marker](../src/auth/infrastructure/adapters/in/public.decorator.ts), [current identity](../src/auth/infrastructure/adapters/in/current-user.decorator.ts) | [guard](../src/auth/infrastructure/adapters/in/jwt-auth.guard.spec.ts), HTTP integration |
| [token-revocation](../openspec/specs/token-revocation/spec.md) | [token validation](../src/auth/application/services/validate-token.service.ts), [logout](../src/auth/application/services/logout.service.ts), [repository](../src/auth/infrastructure/adapters/out/user.kysely.adapter.ts), [auth migration](../src/database/migrations/20260621T000000-add-auth-columns.ts) | [token validation](../src/auth/application/services/validate-token.service.spec.ts), [logout](../src/auth/application/services/logout.service.spec.ts), [repository integration](../test/user.kysely.adapter.spec.ts) |
| [password-hashing](../openspec/specs/password-hashing/spec.md) | [bcrypt adapter](../src/auth/infrastructure/adapters/out/bcrypt.adapter.ts), registration/login services | [bcrypt adapter](../src/auth/infrastructure/adapters/out/bcrypt.adapter.spec.ts), service unit tests, normal-bootstrap storage check |
| [user-roles](../openspec/specs/user-roles/spec.md) | [hierarchy](../src/auth/domain/value-objects/user-role.ts), [role guard](../src/auth/infrastructure/adapters/in/roles.guard.ts), [role migration](../src/database/migrations/20260624T000000-add-roles-column.ts), token validation | [role hierarchy](../src/auth/domain/value-objects/user-role.spec.ts), [role guard](../src/auth/infrastructure/adapters/in/roles.guard.spec.ts), [auth roles e2e](../test/auth-roles.e2e-spec.ts) |

## Reconciled differences

| Archived claim or omission | Current behavior recorded in the main specs |
| --- | --- |
| Logout returns a message saying Logged out | The controller/use case returns HTTP 200 with `{ "success": true }`; the integration suite asserts it |
| A JWT secret only needs a minimum length of 32 | Normal bootstrap also requires at least three of uppercase, lowercase, digit, and other character categories |
| A registration `roles` field is ignored | Normal bootstrap uses whitelist plus forbidNonWhitelisted validation, so this request receives 400; no account is created |
| Authentication uses Passport / a route-path exemption | The current custom NestJS guard delegates to the token-validation use case and reads handler/class public metadata; Passport is not an installed dependency |
| Role checks are described as stateless | Role values come from the token, but every protected request still loads the account and checks its stored token version |
| Guards protect all routes without qualification | The global guards cover registered HTTP controller handlers; they do not establish protection for middleware-served Swagger or future socket messages |
| Error examples show only a message object | Nest HTTP errors also include status/error metadata; consumers should use the documented status and message fields, while validation message values are arrays |

Historical deltas and task lists remain unchanged as records of their time. The new main specs replace neither the archives nor the requirement to validate future changes against actual behavior.

## Verification performed

Verified on 2026-10-22 using the unchanged application source:

| Check | Result |
| --- | --- |
| `pnpm run build` | Passed |
| `pnpm exec tsc --noEmit` | Passed |
| Read-only ESLint over source and test TypeScript | Passed with no errors and two pre-existing unsafe-argument warnings in guard unit tests |
| `pnpm run test --runInBand` | 14 suites, 56 tests passed |
| `pnpm run test:integration --runInBand` | 2 suites, 13 tests passed on the isolated test database |
| `pnpm run test:e2e --runInBand` | 1 suite, 4 tests passed on the isolated test database |
| Normally bootstrapped compiled API | 11 focused checks passed, listed below |

Database-backed checks used a temporary PostgreSQL 17 container with database `robinhoot_issue46_test` on loopback port 55446, explicit test-only credentials, and all three existing migrations. They did not use the database values from the developer's `.env` or substitute a production database. The container used no persistent application volume.

The one-off normal-bootstrap checks started the built application with test-only environment values and exercised:

1. Missing signing secret fails startup.
2. Short signing secret fails startup.
3. Insufficiently diverse signing secret fails startup.
4. Registration returns only id/email and stores bcrypt cost 12, role user, and initial version 1.
5. Duplicate registration returns 409 / Email already in use.
6. Invalid/unknown registration and login fields receive 400, including attempted role injection; no injected-role account is created.
7. Login issues HS256 claims with a 900-second lifetime.
8. Unknown email and wrong password receive the same 401 / Invalid credentials response.
9. Missing/malformed authorization, malformed tokens, expired tokens, and incorrect signatures receive 401 / Unauthorized.
10. Logout returns success true and acts on the validated caller even if the body names another account.
11. Logout rejects the old version's tokens and later login carries the incremented version.

These checks provided runtime evidence for this documentation reconciliation. Their temporary driver was not added as a permanent test suite, and the application/test sources were not modified. Existing test commands require explicit dedicated test database configuration before rerunning them.

## Verification limits and follow-up boundaries

- The shared [test application helper](../test/helpers/setup-test-app.ts) constructs AppModule directly and does not run `main.ts`. It does not install the normal bootstrap validation pipes, CORS, rate limiting, or secret checks. A passing existing integration/e2e suite alone cannot establish those settings; the separate normal-bootstrap checks cover the relevant claims above.
- The RBAC e2e suite exercises registration/login/logout, not an actual admin-only route. Hierarchy and AND semantics are supported by guard/domain unit tests and source inspection; production-role-route integration coverage remains a future testing improvement.
- Existing JWT adapter unit tests mock signing/verification. The separate normal-bootstrap checks established the issued algorithm/lifetime and rejection of an expired token. This baseline does not claim an explicit verifier algorithm allowlist or complete runtime claim-schema validation that the current adapter does not configure.
- No refresh-token endpoint, self-service role-management endpoint, quiz-owner check, or WebSocket authentication boundary exists yet. Existing role claims can remain stale after a storage-only role change until login or account-wide version revocation. Future resource ownership checks remain separate from user/admin role hierarchy.
- The initial account version and default roles are both in migrations and repository creation. Keep those facts distinct from historical task checkbox completion.

See [the existing authentication contract](contracts/authentication.md), [the API/UI boundary](api-ui-boundary.md), and [the issue map](mvp-issue-map.md) for implementation and consumer handoff context.
