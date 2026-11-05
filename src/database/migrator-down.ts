import 'dotenv/config';
import { migrationContext } from './migration-context';

async function migrateDown() {
  const { db, migrator } = migrationContext();

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
    process.exit(1);
  }

  if (results?.length === 0) {
    console.log('No migrations to roll back.');
  }

  await db.destroy();
}

migrateDown().catch(() => {
  console.error(
    'Rollback failed; check database connectivity and configuration',
  );
  process.exit(1);
});
