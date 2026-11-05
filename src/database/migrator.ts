import 'dotenv/config';
import { migrationContext } from './migration-context';

async function migrateToLatest() {
  const { db, migrator } = migrationContext();

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`Migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === 'Error') {
      console.error(`Failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error('Failed to migrate');
    process.exit(1);
  }

  await db.destroy();
}

migrateToLatest().catch(() => {
  console.error(
    'Migration failed; check database connectivity and configuration',
  );
  process.exit(1);
});
