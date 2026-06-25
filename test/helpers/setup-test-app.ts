import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Kysely, PostgresDialect } from 'kysely';
import { AppModule } from '../../src/app.module';
import { KYSELY_TOKEN } from '../../src/database/database.provider';
import { Database } from '../../src/database/database.types';
import { TestPool } from './test-pool';

export async function createTestApp(): Promise<{
  app: INestApplication;
  pool: TestPool;
  db: Kysely<Database>;
}> {
  const pool = new TestPool({
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'robinhoot',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    max: 1,
  });

  const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  });

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(KYSELY_TOKEN)
    .useValue(db)
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  return { app, pool, db };
}

export async function beginTransaction(pool: TestPool): Promise<void> {
  const client = await pool.connect();
  await client.query('BEGIN');
  pool.transactionClient = client;
}

export async function rollbackTransaction(pool: TestPool): Promise<void> {
  if (pool.transactionClient) {
    await pool.transactionClient.query('ROLLBACK');
    pool.transactionClient.release();
    pool.transactionClient = null;
  }
}

export async function destroyTestApp(
  app: INestApplication,
  db: Kysely<Database>,
): Promise<void> {
  await db.destroy();
  await app.close();
}
