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

## OpenCode

This project uses [OpenCode](https://opencode.ai/docs) — an AI-native coding assistant. Below are the project-specific configurations and tooling.

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

**OpenSpec workflow skills** (`.opencode/skills/`):
- **openspec-propose** — Create a new change with proposal, design, and tasks
- **openspec-apply-change** — Implement tasks from an OpenSpec change
- **openspec-archive-change** — Archive a completed change
- **openspec-explore** — Explore ideas and clarify requirements
- **openspec-sync-specs** — Sync delta specs back to main specs

### Custom Commands

Custom slash-commands available in OpenCode:

| Command | Description |
|---------|-------------|
| `/test` | Run unit, integration, e2e tests + coverage and suggest improvements |
