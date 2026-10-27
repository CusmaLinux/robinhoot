import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import type { Server } from 'http';
import type { INestApplication } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import request from 'supertest';
import type { Database } from '../src/database/database.types';
import { REPORT_REPOSITORY_PORT } from '../src/room/application/ports/out/report.repository.port';
import type { ReportRepositoryPort } from '../src/room/application/ports/out/report.repository.port';
import {
  buildGameReport,
  type GameReport,
} from '../src/room/domain/game-report';
import { completedRoom } from '../src/room/domain/game-report.fixture';
import { TestPool } from './helpers/test-pool';
import {
  createTestApp,
  beginTransaction,
  rollbackTransaction,
  destroyTestApp,
} from './helpers/setup-test-app';

describe('Owned report history HTTP', () => {
  let app: INestApplication;
  let db: Kysely<Database>;
  let pool: TestPool;
  let server: Server;
  let token: string;
  let report: GameReport;
  beforeAll(async () => {
    if (!process.env.DB_NAME?.endsWith('_test'))
      throw new Error('Dedicated test database required');
    ({ app, db, pool } = await createTestApp({ validation: true }));
    server = app.getHttpServer() as Server;
  });
  beforeEach(async () => {
    await beginTransaction(pool);
    const credentials = {
      email: 'history@example.com',
      password: 'TestPassword123!',
    };
    await request(server).post('/auth/register').send(credentials).expect(201);
    const login = await request(server)
      .post('/auth/login')
      .send(credentials)
      .expect(200);
    token = (login.body as { accessToken: string }).accessToken;
    const owner = await db
      .selectFrom('users')
      .select('id')
      .where('email', '=', credentials.email)
      .executeTakeFirstOrThrow();
    const roomId = randomUUID();
    report = buildGameReport(
      { ...completedRoom(), roomId, host: { ownerId: owner.id } },
      '2026-10-27T01:00:00.000Z',
    );
    await app
      .get<ReportRepositoryPort>(REPORT_REPOSITORY_PORT)
      .saveOnce(report);
  });
  afterEach(async () => rollbackTransaction(pool));
  afterAll(async () => {
    if (app) await destroyTestApp(app, db);
  });

  it('lists only reports owned by the authenticated account', async () => {
    const foreignId = randomUUID();
    await app.get<ReportRepositoryPort>(REPORT_REPOSITORY_PORT).saveOnce({
      ...report,
      id: foreignId,
      roomId: foreignId,
      ownerId: randomUUID(),
    });
    const response = await request(server)
      .get('/reports')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(response.body).toEqual([report]);
  });
  it('reopens the original owned report document', async () => {
    const response = await request(server)
      .get(`/reports/${report.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(response.body).toEqual(report);
  });

  it.each(['user', 'admin'])(
    'hides foreign history from a %s account',
    async (role) => {
      const credentials = {
        email: 'foreign@example.com',
        password: 'TestPassword123!',
      };
      await request(server)
        .post('/auth/register')
        .send(credentials)
        .expect(201);
      if (role === 'admin')
        await db
          .updateTable('users')
          .set({ roles: sql`'["admin"]'::jsonb` })
          .where('email', '=', credentials.email)
          .execute();
      const login = await request(server)
        .post('/auth/login')
        .send(credentials)
        .expect(200);
      const foreign = (login.body as { accessToken: string }).accessToken;
      expect(
        (
          await request(server)
            .get('/reports')
            .auth(foreign, { type: 'bearer' })
            .expect(200)
        ).body,
      ).toEqual([]);
      const denied = await request(server)
        .get(`/reports/${report.id}`)
        .auth(foreign, { type: 'bearer' })
        .expect(404);
      const missing = await request(server)
        .get(`/reports/${randomUUID()}`)
        .auth(foreign, { type: 'bearer' })
        .expect(404);
      expect(denied.body).toEqual(missing.body);
    },
  );
  it.each(['/reports', '/reports/00000000-0000-4000-8000-000000000000'])(
    'rejects missing account authentication on %s',
    async (path) => {
      await request(server).get(path).expect(401);
    },
  );
  it('rejects malformed report IDs before querying storage', async () => {
    await request(server)
      .get('/reports/not-a-uuid')
      .auth(token, { type: 'bearer' })
      .expect(400);
  });
  it('rejects revoked account access to report history', async () => {
    await request(server)
      .post('/auth/logout')
      .auth(token, { type: 'bearer' })
      .expect(200);
    await request(server)
      .get('/reports')
      .auth(token, { type: 'bearer' })
      .expect(401);
    await request(server)
      .get(`/reports/${report.id}`)
      .auth(token, { type: 'bearer' })
      .expect(401);
  });
  it('orders owned history newest first and stabilizes equal timestamps by report ID', async () => {
    const repository = app.get<ReportRepositoryPort>(REPORT_REPOSITORY_PORT);
    const newer = {
      ...report,
      id: randomUUID(),
      completedAt: '2026-10-28T01:00:00.000Z',
    };
    await repository.saveOnce({ ...newer, roomId: newer.id });
    const sameTime = { ...report, id: randomUUID() };
    await repository.saveOnce({ ...sameTime, roomId: sameTime.id });
    const response = await request(server)
      .get('/reports')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect((response.body as GameReport[]).map((item) => item.id)).toEqual([
      newer.id,
      ...[report.id, sameTime.id].sort(),
    ]);
  });

  it('reopens committed report snapshots after source deletion and a fresh backend instance', async () => {
    const credentials = {
      email: `history-restart-${randomUUID()}@example.com`,
      password: 'TestPassword123!',
    };
    const first = await createTestApp({ validation: true });
    let second: Awaited<ReturnType<typeof createTestApp>> | undefined;
    let ownerId: string | undefined;
    let committed: GameReport | undefined;
    try {
      const firstServer = first.app.getHttpServer() as Server;
      await request(firstServer)
        .post('/auth/register')
        .send(credentials)
        .expect(201);
      const login = await request(firstServer)
        .post('/auth/login')
        .send(credentials)
        .expect(200);
      const accountToken = (login.body as { accessToken: string }).accessToken;
      ownerId = (
        await first.db
          .selectFrom('users')
          .select('id')
          .where('email', '=', credentials.email)
          .executeTakeFirstOrThrow()
      ).id;
      const source = await request(firstServer)
        .post('/quizzes')
        .auth(accountToken, { type: 'bearer' })
        .send({})
        .expect(201);
      const sourceId = (source.body as { id: string }).id;
      const id = randomUUID();
      committed = {
        ...report,
        id,
        roomId: id,
        ownerId,
        quiz: { ...report.quiz, sourceQuizId: sourceId },
      };
      await first.app
        .get<ReportRepositoryPort>(REPORT_REPOSITORY_PORT)
        .saveOnce(committed);
      await request(firstServer)
        .delete(`/quizzes/${sourceId}`)
        .auth(accountToken, { type: 'bearer' })
        .expect(204);
      await first.app.close();
      second = await createTestApp({ validation: true });
      const secondServer = second.app.getHttpServer() as Server;
      expect(
        (
          await request(secondServer)
            .get(`/reports/${id}`)
            .auth(accountToken, { type: 'bearer' })
            .expect(200)
        ).body,
      ).toEqual(committed);
      expect(
        (
          await request(secondServer)
            .get('/reports')
            .auth(accountToken, { type: 'bearer' })
            .expect(200)
        ).body,
      ).toEqual([committed]);
    } finally {
      const cleanup = second ?? first;
      if (committed)
        await cleanup.db
          .deleteFrom('reports')
          .where('room_id', '=', committed.id)
          .execute();
      if (ownerId) {
        await cleanup.db
          .deleteFrom('quizzes')
          .where('owner_id', '=', ownerId)
          .execute();
        await cleanup.db
          .deleteFrom('users')
          .where('id', '=', ownerId)
          .execute();
      }
      if (second) await destroyTestApp(second.app, second.db);
      await destroyTestApp(first.app, first.db);
    }
  });

  it('publishes owned-history schemas and chart-ready report facts in OpenAPI', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    expect(document.paths['/reports'].get?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: { $ref: '#/components/schemas/GameReportDto' },
          },
        },
      },
    });
    expect(document.paths['/reports/{id}'].get?.responses).toHaveProperty(
      '404',
    );
    expect(document.components?.schemas?.ReportDifficultyDto).toMatchObject({
      required: [
        'questionId',
        'eligible',
        'correct',
        'incorrect',
        'missing',
        'accuracy',
      ],
    });
  });
});
