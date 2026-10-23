# Existing authentication API contract

This is the implemented HTTP contract reconciled for [issue #46](https://github.com/CusmaLinux/robinhoot/issues/46), not a proposal for a new authentication flow. See [baseline evidence and limitations](../authentication-baseline.md) and the [main user-auth spec](../../openspec/specs/user-auth/spec.md).

## Operations

| Operation | Authentication | Request | Successful response |
| --- | --- | --- | --- |
| `POST /auth/register` | Public | Email and 8–128-character password | 201 with `id` and `email`; no access token |
| `POST /auth/login` | Public | Valid email and nonempty password | 200 with `accessToken` |
| `POST /auth/logout` | `Authorization: Bearer <access-token>` | No account id or request body required | 200 with `success: true` |

The `/api` path is the Swagger documentation UI in non-production bootstrap; it is not a prefix for the auth routes. Documentation is disabled by the normal production bootstrap. Response examples below describe actual behavior; TypeScript response interfaces alone do not guarantee complete generated OpenAPI response schemas.

### Register and log in separately

Registration request:

```json
{ "email": "alice@example.com", "password": "ExamplePassword123!" }
```

Registration success:

```json
{ "id": "<account-uuid>", "email": "alice@example.com" }
```

Send the same email/password fields to login. A successful login returns:

```json
{ "accessToken": "<signed-access-token>" }
```

Normal bootstrap rejects invalid input and unknown properties, including a caller-supplied `roles` field. Registration always assigns the user role. The current API provides neither a refresh-token operation nor a public role-selection operation.

### Authenticate and log out

For protected HTTP handlers, supply the header `Authorization: Bearer <signed-access-token>`. Access tokens expire 900 seconds after issuance and carry account subject, email, roles, and tokenVersion plus issued/expiry timestamps. The server verifies the token, looks up the account, and checks its persistent token version before allowing protected handling.

Logout uses the validated caller; a body cannot select another account to log out. Successful logout returns:

```json
{ "success": true }
```

Logout increments the account's version and invalidates all previously issued tokens with the prior version, including the one used to log out. Subsequent calls with an old token return 401. A later login issues the new version. Requesting logout again with a revoked token is not an idempotent 200 response.

## Errors and authorization

| Condition | Status | Message field |
| --- | --- | --- |
| Invalid DTO fields or unknown input properties | 400 | Array of field validation messages |
| Email already found during registration | 409 | `Email already in use` |
| Unknown login email or incorrect password | 401 | `Invalid credentials` |
| Missing/malformed/invalid/expired token, missing account, or token-version mismatch on protected handlers | 401 | `Unauthorized` |
| Valid authentication but unmet declared handler role requirements | 403 | `Insufficient permissions` |

Typical protected-request error:

```json
{ "message": "Unauthorized", "error": "Unauthorized", "statusCode": 401 }
```

Typical validation error includes `statusCode: 400`, `error: "Bad Request"`, and an array in `message`. Consumers must handle that array as well as the string message used by other errors. The normal bootstrap also applies HTTP rate limiting; the table describes authentication/domain failures rather than every middleware or server error.

Admin satisfies user requirements, and a handler requiring several roles requires all of them through that hierarchy. Without a handler role restriction, authentication still applies unless the handler is public. Roles are copied at login; the database lookup for token revocation does not refresh an existing token's role claims. User/admin roles do not establish ownership of future quizzes, reports, or live rooms.

## Separate UI integration

The UI repository owns login screens, credential storage, login-on-expiry interaction, field-error presentation, and routing. This API contract makes no client framework or storage decision. Reuse these existing operations; new MVP features must document their own owned-resource checks and HTTP/Socket.IO payloads.

Configure actual frontend origins for deployment. CORS access does not replace bearer authentication. The existing HTTP guard is not a WebSocket identity solution; live host/player authorization is future MVP work.
