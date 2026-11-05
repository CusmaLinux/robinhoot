import * as path from 'path';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import { Kysely, PostgresDialect } from 'kysely';
import { Migrator, FileMigrationProvider } from 'kysely/migration';
import type { Database } from './database.types';
import { databaseConfig } from './database.config';

/** Both migration directions must use the same connection and discovery policy. */
export function migrationContext() {
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        ...databaseConfig(),
        max: 1,
        query_timeout: 0,
        statement_timeout: 0,
      }),
    }),
  });
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });
  return { db, migrator };
}
