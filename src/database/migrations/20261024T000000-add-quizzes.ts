import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('quizzes')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('owner_id', 'uuid', (col) =>
      col.notNull().references('users.id'),
    )
    .addColumn('title', 'varchar(200)', (col) => col.notNull())
    .addColumn('questions', 'jsonb', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
  await db.schema
    .createIndex('quizzes_owner_created_id_idx')
    .on('quizzes')
    .columns(['owner_id', 'created_at', 'id'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('quizzes').execute();
}
