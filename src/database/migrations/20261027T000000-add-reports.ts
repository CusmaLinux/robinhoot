import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('reports')
    .addColumn('room_id', 'uuid', (column) => column.primaryKey())
    .addColumn('owner_id', 'uuid', (column) => column.notNull())
    .addColumn('document', 'jsonb', (column) => column.notNull())
    .execute();
  await db.schema
    .createIndex('reports_owner_idx')
    .on('reports')
    .column('owner_id')
    .execute();
}

export function down(): Promise<void> {
  return Promise.reject(
    new Error(
      'Reports contain durable results; export or back them up before a manual rollback',
    ),
  );
}
