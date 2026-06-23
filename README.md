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
