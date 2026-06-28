import * as path from 'path';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import { Kysely, PostgresDialect } from 'kysely';
import { Migrator, FileMigrationProvider } from 'kysely/migration';
import { Database } from './database.types';
import 'dotenv/config';

async function migrateDown() {
  if (!process.env.DB_PASSWORD) {
    throw new Error('DB_PASSWORD environment variable is not set');
  }

  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'robinhoot',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
      }),
    }),
  });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      // Points to the centralized migrations folder
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });

  // Roll back a single migration
  const { error, results } = await migrator.migrateDown();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(
        `✅ Rollback of "${it.migrationName}" was executed successfully`,
      );
    } else if (it.status === 'Error') {
      console.error(`❌ Failed to execute rollback of "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error('Failed to migrate down');
    console.error(error);
    process.exit(1);
  }

  if (results?.length === 0) {
    console.log('No migrations to roll back.');
  }

  await db.destroy();
}

migrateDown().catch((error) => {
  console.error('Unexpected error during migration', error);
});
