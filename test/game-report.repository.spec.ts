import { randomUUID } from 'crypto';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import type { Database } from '../src/database/database.types';
import { ReportKyselyAdapter } from '../src/room/infrastructure/adapters/out/report.kysely.adapter';
import { buildGameReport } from '../src/room/domain/game-report';
import { completedRoom } from '../src/room/domain/game-report.fixture';

describe('Immutable report persistence (dedicated PostgreSQL)', () => {
  let db: Kysely<Database>;
  let repository: ReportKyselyAdapter;
  const roomId = randomUUID();
  beforeAll(() => {
    if (!process.env.DB_NAME?.endsWith('_test'))
      throw new Error('Explicit *_test database required');
    db = new Kysely({
      dialect: new PostgresDialect({
        pool: new Pool({
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          database: process.env.DB_NAME,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
        }),
      }),
    });
    repository = new ReportKyselyAdapter(db);
  });
  afterAll(async () => {
    if (db) {
      await db.deleteFrom('reports').where('room_id', '=', roomId).execute();
      await db.destroy();
    }
  });
  it('returns one original report for concurrent writes with conflicting candidates', async () => {
    const room = {
      ...completedRoom(),
      roomId,
      host: { ownerId: randomUUID() },
    };
    const original = buildGameReport(room, '2026-10-27T01:00:00.000Z');
    const initial = await Promise.all(
      Array.from({ length: 5 }, () => repository.saveOnce(original)),
    );
    const stored = initial[0];
    expect(initial).toEqual(Array(5).fill(original));
    const retries = await Promise.all(
      Array.from({ length: 5 }, () =>
        repository.saveOnce({
          ...original,
          completedAt: '2026-10-28T01:00:00.000Z',
        }),
      ),
    );
    expect(stored).toEqual(original);
    expect(retries).toEqual(Array(5).fill(original));
    expect(
      await db
        .selectFrom('reports')
        .select('room_id')
        .where('room_id', '=', roomId)
        .execute(),
    ).toHaveLength(1);
  });
  it('bounds a blocked write and leaves the original report unchanged after rollback', async () => {
    let unlock!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const original = (
      await db
        .selectFrom('reports')
        .select('document')
        .where('room_id', '=', roomId)
        .executeTakeFirstOrThrow()
    ).document;
    const lock = db.transaction().execute(async (transaction) => {
      await sql`LOCK TABLE reports IN ACCESS EXCLUSIVE MODE`.execute(
        transaction,
      );
      entered();
      await gate;
    });
    await started;
    try {
      await expect(
        repository.saveOnce({
          ...original,
          completedAt: '2026-10-29T00:00:00.000Z',
        }),
      ).rejects.toThrow(/statement timeout/);
    } finally {
      unlock();
      await lock;
    }
    const stored = await repository.saveOnce(original);
    expect(stored).toEqual(original);
    expect(Object.isFrozen(stored.standings[0])).toBe(true);
  }, 10_000);
  it('does not return or replace another owner report on a room collision', async () => {
    const original = (
      await db
        .selectFrom('reports')
        .select('document')
        .where('room_id', '=', roomId)
        .executeTakeFirstOrThrow()
    ).document;
    await expect(
      repository.saveOnce({ ...original, ownerId: randomUUID() }),
    ).rejects.toThrow();
    expect(await repository.saveOnce(original)).toEqual(original);
  });
});
