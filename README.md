## Robinhoot

Create educational exercises and practice with your students—all in real time. Have fun!

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## API Documentation (Swagger)

Once the server is running, interactive Swagger docs are available at:

- **Swagger UI:** [http://localhost:3000/api](http://localhost:3000/api)
- **JSON spec:** [http://localhost:3000/api-json](http://localhost:3000/api-json)

The Swagger UI provides a visual interface to browse endpoints, inspect request/response schemas, and make live API calls.

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov

# test integration
$ pnpm run test:integration

# test all
$ pnpm run test:all
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

 ## Database Migrations (Kysely)
 
 This project uses [Kysely](https://kysely.dev/) as a type-safe SQL query builder, with a centralized migration system located in `src/database/migrations`. Migrations are executed directly in TypeScript using `tsx`.
 
 ### Prerequisites
 Before running migrations, ensure your PostgreSQL database is running and your `.env` file is configured at the root of the project:
 
 ```env
 DB_HOST=localhost
 DB_PORT=5432
 DB_USER=postgres
 DB_PASSWORD=password
 DB_NAME=robinhoot
 ```

 ### Docker compose setup

 You can use docker compose to execute a container with a postgres database, in the root of the project you can run: 

 `docker compose up -d` 
 
 ### Available Commands
 
 We use `pnpm` to manage migration scripts.
 
 | Command | Description |
 | --- | --- |
 | `pnpm db:migration:make <name>` | Generates a new timestamped migration file in the `migrations` folder. |
 | `pnpm db:migrate` | Applies all pending migrations to the database. |
 | `pnpm db:migrate:down` | Reverts the most recently applied migration (one step back). |
 
 ---
 
 ### Standard Workflow
 
 **1. Create a new migration**
 Whenever you need to alter the database schema, generate a new file with a descriptive name:
 
 ```bash
 pnpm db:migration:make create_users_table
 ```
 
 *This creates a file like: `src/database/migrations/20260619153000-create_users_table.ts`*
 
 **2. Write the schema changes**
 Open the generated file and write your `up` and `down` logic using Kysely's schema builder:
 
 ```typescript
 import { Kysely, sql } from 'kysely';
 
 export async function up(db: Kysely<any>): Promise<void> {
   await db.schema
     .createTable('users')
     .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
     // ... add columns
     .execute();
 }
 
 export async function down(db: Kysely<any>): Promise<void> {
   await db.schema.dropTable('users').execute();
 }
 ```
 
 **3. Apply the migration**
 Push your changes to the database:
 
 ```bash
 pnpm db:migrate
 ```
 
 **4. (Optional) Rollback**
 If you made a mistake locally, you can instantly revert the last applied migration:
 
 ```bash
 pnpm db:migrate:down
 ```
 
 ### Architecture Note
 
 While the application follows Hexagonal Architecture and Vertical Slices, the database schema and migrations are treated as centralized, cross-cutting infrastructure. Feature modules (like `users` or `products`) interact with Kysely via their Outbound Adapters (e.g., `user.kysely.adapter.ts`).

## AI assistants: OpenCode and Codex

This project supports [OpenCode](https://opencode.ai/docs) and Codex from the same checkout. Both read `AGENTS.md`, share domain skills, OpenSpec artifacts, and Fallow configuration. Switching assistants does not require moving specifications or changing application code. Conversation history stays in the assistant where it was created.

### Quick start

```bash
pnpm install --frozen-lockfile
pnpm exec openspec list --json
pnpm exec fallow --version
```

Open the repository in either assistant. Codex reads the project-scoped MCP configuration in [`.codex/config.toml`](.codex/config.toml) for trusted projects. OpenCode reads [`opencode.jsonc`](opencode.jsonc). Both start Fallow with `pnpm exec fallow-mcp`; CodeGraph uses the installed `codegraph` CLI.

After changing MCP or custom-agent configuration, start a fresh Codex chat; restart the app if the tools do not appear. Check the effective CLI configuration with `codex mcp list`. A configuration listing alone does not prove a server started successfully.

| Capability | OpenCode | Codex |
|---|---|---|
| Project instructions | `AGENTS.md` | `AGENTS.md` |
| Domain skills | `.agents/skills/` | `.agents/skills/` |
| OpenSpec workflows | `/opsx-propose`, `/opsx-explore`, `/opsx-apply`, `/opsx-sync`, `/opsx-archive` | `$openspec-propose`, `$openspec-explore`, `$openspec-apply-change`, `$openspec-sync-specs`, `$openspec-archive-change` |
| Test review | `/test` | `$project-test` |
| Custom agents | `.opencode/agents/*.md` | `.codex/agents/*.toml` |
| MCP configuration | `opencode.jsonc` | `.codex/config.toml` |

Codex custom agents preserve the three existing roles and inherit the parent model and permissions. `docs-writer` and `review` disable shell tools. Read-only review and security-audit behavior is also specified in their instructions; this does not create a separate read-only sandbox. Ask explicitly to delegate, for example: “Use the security-auditor agent to review this change.”

OpenCode's `/test` includes an OpenCode-specific model selection. Codex's `$project-test` uses the current model and runs the same suites without requiring that provider.

### RTK: condensed command output in Codex

[RTK](https://github.com/rtk-ai/rtk) reduces the output of supported development commands before Codex receives it, saving context tokens during repetitive work. It integrates through a shell-command hook, independently of the CodeGraph and Fallow MCP connections.

Once the RTK CLI is installed and available on `PATH`, configure it globally:

```bash
rtk init -g --codex
```

This creates or updates the following files under `$CODEX_HOME` (default: `~/.codex/`):

| File | Purpose |
|---|---|
| `hooks.json` | Runs `rtk hook codex` on `PreToolUse` events matching `Bash` |
| `AGENTS.md` | References the global `RTK.md` instructions |
| `RTK.md` | Explains how Codex should handle condensed output and recover unusable results |

The global setup applies across projects; a second project-local RTK setup is unnecessary. Restart Codex after installation. In Codex CLI, open `/hooks` and review and trust the RTK hook if it is awaiting approval. Codex skips untrusted hooks; see the [Codex hook documentation](https://learn.chatgpt.com/docs/hooks).

For supported commands, the flow is: Codex requests a shell command → the hook returns `updatedInput` with an RTK wrapper → Codex applies its normal approval and sandbox checks → RTK executes the command and returns condensed output. For example, `git status` becomes `rtk git status`.

Check installation, preview a rewrite without executing it, and inspect recorded savings:

```bash
rtk init -g --codex --show
rtk hook check --agent codex git status
rtk gain
```

To verify automatic execution, ask Codex to run `git status` normally, then inspect `rtk gain`. A successful rewrite preview proves the RTK processor works, but does not prove Codex loaded and trusted the hook. If savings remain empty, check `/hooks` and restart the session. Running plain `git status` directly in your own terminal does not invoke Codex's hook.

RTK filters supported shell-command output; it does not automatically condense CodeGraph or Fallow MCP responses. Follow any recovery instructions in condensed results. Use `rtk bypass <command>` to recover raw output when the condensed result is unusable.

### OpenSpec

[OpenSpec](https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md) is a spec-driven development workflow integrated into this project. Changes are planned and tracked as structured artifacts (proposals, designs, specs, tasks) under `openspec/`. Use the commands below to interact with the OpenSpec lifecycle.

### Skills

Skills encapsulate reusable expertise for the AI assistant. This project defines skills under two locations:

**Domain skills** (`.agents/skills/`):
- **caveman** — Ultra-compressed communication mode
- **diagnose** — Disciplined diagnosis loop for hard bugs and regressions
- **hexagonal-architecture** — Ports & Adapters design patterns
- **improve-codebase-architecture** — Refactoring and consolidation opportunities
- **nestjs-best-practices** — NestJS best practices for production apps
- **nodejs-backend-patterns** — Backend service patterns (Express/Fastify)
- **nodejs-best-practices** — Node.js development principles
- **tdd** — Test-driven development (red-green-refactor)
- **to-issues** — Break plans into traceable issues
- **to-prd** — Generate PRDs from conversation context
- **typescript-advanced-types** — Advanced TypeScript type system patterns
- **project-test** — Complete test and coverage review (Codex equivalent of `/test`)

**OpenSpec workflow skills** (maintained in `.opencode/skills/`, linked into `.agents/skills/` for Codex):
- **openspec-propose** — Create a new change with proposal, design, and tasks
- **openspec-apply-change** — Implement tasks from an OpenSpec change
- **openspec-archive-change** — Archive a completed change
- **openspec-explore** — Explore ideas and clarify requirements
- **openspec-sync-specs** — Sync delta specs back to main specs

### Sub-Agents

Specialized sub-agents are available for focused tasks. OpenCode definitions are in [`.opencode/agents/`](.opencode/agents/); matching Codex definitions are in [`.codex/agents/`](.codex/agents/):

| Agent | Description |
|-------|-------------|
| [`docs-writer`](.opencode/agents/docs-writer.md) | Writes and maintains project documentation |
| [`review`](.opencode/agents/review.md) | Reviews code for quality and best practices |
| [`security-auditor`](.opencode/agents/security-auditor.md) | Performs security audits and identifies vulnerabilities |

### GitHub Actions

Two GitHub Actions workflows provide OpenCode integrations in CI/CD. These remain independent of the local assistant you use:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| [`opencode.yml`](.github/workflows/opencode.yml) | Issue / PR review comments containing `/oc` or `/opencode` | Run OpenCode on demand via comments |
| [`ocr-review.yml`](.github/workflows/ocr-review.yml) | CI workflow completion | OpenCodeReview PR review after CI |

### Custom Commands

Custom slash-commands available in OpenCode:

| Command | Description |
|---------|-------------|
| `/test` | Run unit, integration, e2e tests + coverage and suggest improvements |

### CodeGraph

[CodeGraph](https://colbymchenry.github.io/codegraph/) is a code intelligence tool that builds a pre-indexed SQLite knowledge graph of every symbol, call edge, and file in the workspace, auto-syncing on file changes. It lets the AI answer questions about architecture, call flows, and symbol locations in a single round-trip instead of a `grep`/`read` loop.

When you run `codegraph init`, a `.codegraph/` directory is created at the project root with the live index. The AI assistant is configured to reach for CodeGraph before grep or file reads (see the [CodeGraph section](AGENTS.md#CodeGraph) in `AGENTS.md`).

To install and set up CodeGraph in your own project:

1. Install the CLI following the linked CodeGraph installation guide.
2. Index your project: `codegraph init --yes`.
3. This repository already declares the CodeGraph MCP connection for both assistants.
4. Verify the index with `codegraph status`; query it with `codegraph explore "<question>"`.

The `.codegraph/` index is local and ignored by Git. On a new checkout, initialize it before using indexed code queries. The MCP launcher `codegraph serve --mcp` remains supported by the installed CLI even though `serve` is hidden from its help output.

See the [CodeGraph documentation](https://colbymchenry.github.io/codegraph/getting-started/introduction/) for installation, configuration, and advanced usage.

## Code Quality

This project uses [Fallow](https://github.com/fallow-rs/fallow) — a Rust-native codebase intelligence tool for TypeScript and JavaScript. Fallow detects dead code, code duplication, circular dependencies, complexity hotspots, architecture boundary violations, and more, for more information review the [fallow docs](https://docs.fallow.tools/installation).

### Installation

Fallow and OpenSpec are project devDependencies, pinned through `pnpm-lock.yaml`. Install them with the rest of the project:

```bash
pnpm install --frozen-lockfile
```

No global Fallow or OpenSpec installation is required. Use `pnpm exec fallow` and `pnpm exec openspec` for direct CLI commands.

### Running an audit

The `fallow audit` command analyzes changed files against a base branch and returns a verdict (pass/warn/fail):

```bash
pnpm exec fallow audit
```

### CI integration

Fallow runs as part of the CI pipeline via the `fallow-rs/fallow@v3` GitHub Action — see the [`fallow-audit` job](.github/workflows/ci.yml) for details.

### Maintaining the shared setup

The five `.agents/skills/openspec-*` entries are relative symlinks to the existing OpenCode workflows. Edit the target files to update both assistants. Shared workflows mention OpenCode tool names and `/opsx-*`; `AGENTS.md` maps those to Codex tools and skills, including the project-local OpenSpec CLI. If regenerating workflows with `pnpm exec openspec init` or `update`, review the diff and preserve this shared arrangement.

Codex and OpenCode custom-agent definitions use different formats and must be updated together when role behavior changes. Their CI workflows are not migrated by the local Codex configuration.

`pnpm run test:all` currently runs unit coverage and integration tests only; run e2e separately or use the assistant's complete test-review workflow.
