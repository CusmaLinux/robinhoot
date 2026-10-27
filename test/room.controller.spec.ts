import 'dotenv/config';
import { randomUUID } from 'crypto';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'net';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CREATE_ROOM_EXAMPLE,
  ROOM_CREATED_EXAMPLE,
  ROOM_NOT_HOSTABLE_EXAMPLE,
  ROOM_ACTIVE_EXAMPLE,
} from '../src/room/infrastructure/adapters/in/room-api.examples';
import request from 'supertest';
import type { Database } from '../src/database/database.types';
import type { TestPool } from './helpers/test-pool';
import { ROOM_STORE_PORT } from '../src/room/application/ports/out/room-store.port';
import type { RoomStorePort } from '../src/room/application/ports/out/room-store.port';
import {
  beginTransaction,
  createTestApp,
  destroyTestApp,
  rollbackTransaction,
} from './helpers/setup-test-app';

describe('Owned room creation (HTTP + PostgreSQL)', () => {
  let app: INestApplication;
  let pool: TestPool;
  let db: Kysely<Database>;
  let server: Server;
  let token: string;

  beforeAll(async () => {
    if (!process.env.DB_NAME?.endsWith('_test')) {
      throw new Error(
        'Room integration tests require a dedicated *_test database',
      );
    }
    ({ app, pool, db } = await createTestApp({ validation: true }));
    server = app.getHttpServer() as Server;
  });

  async function login(email = 'room-owner@example.com', admin = false) {
    await request(server)
      .post('/auth/register')
      .send({ email, password: 'TestPassword123!' })
      .expect(201);
    if (admin)
      await db
        .updateTable('users')
        .set({ roles: sql`'["admin"]'::jsonb` })
        .where('email', '=', email)
        .execute();
    const response = await request(server)
      .post('/auth/login')
      .send({ email, password: 'TestPassword123!' })
      .expect(200);
    return (response.body as { accessToken: string }).accessToken;
  }

  beforeEach(async () => {
    await beginTransaction(pool);
    token = await login();
  });

  afterEach(async () => {
    if (pool) await rollbackTransaction(pool);
  });
  afterAll(async () => {
    if (app) await destroyTestApp(app, db);
  });

  function question(prompt: string) {
    const options = ['Animal', 'Bacterium', 'Virus', 'None'].map((text) => ({
      id: randomUUID(),
      text,
    }));
    return {
      id: randomUUID(),
      type: 'multiple-choice',
      prompt,
      options,
      correctOptionIds: [options[0].id],
      durationSeconds: 20,
    };
  }

  async function hostableQuiz() {
    const draft = await request(server)
      .post('/quizzes')
      .auth(token, { type: 'bearer' })
      .send({})
      .expect(201);
    const quizId = (draft.body as { id: string }).id;
    const content = {
      title: 'Biology',
      questions: [question('First?'), question('Second?')],
    };
    await request(server)
      .put(`/quizzes/${quizId}`)
      .auth(token, { type: 'bearer' })
      .send(content)
      .expect(200);
    return { quizId, content };
  }

  it('creates safe room metadata for an owned hostable quiz', async () => {
    const { quizId } = await hostableQuiz();
    const response = await request(server)
      .post('/rooms')
      .auth(token, { type: 'bearer' })
      .send({ quizId, requestId: randomUUID() })
      .expect(201);
    expect(response.body).toEqual({
      roomId: expect.any(String) as unknown,
      pin: expect.stringMatching(/^\d{6}$/) as unknown,
      phase: 'lobby',
      revision: 0,
      createdAt: expect.any(String) as unknown,
    });
  });

  it('retains frozen question content and order after source edits and deletion', async () => {
    const { quizId, content } = await hostableQuiz();
    const response = await request(server)
      .post('/rooms')
      .auth(token, { type: 'bearer' })
      .send({ quizId, requestId: randomUUID() })
      .expect(201);
    const roomId = (response.body as { roomId: string }).roomId;
    await request(server)
      .put(`/quizzes/${quizId}`)
      .auth(token, { type: 'bearer' })
      .send({ title: 'Changed', questions: [...content.questions].reverse() })
      .expect(200);
    await request(server)
      .delete(`/quizzes/${quizId}`)
      .auth(token, { type: 'bearer' })
      .expect(204);
    const room = app.get<RoomStorePort>(ROOM_STORE_PORT).findById(roomId)!;
    expect(room.quiz).toEqual({ version: 1, sourceQuizId: quizId, ...content });
    expect(Object.isFrozen(room.quiz.questions[0].options[0])).toBe(true);
    expect(() => {
      (room.quiz.questions[0].correctOptionIds as string[]).push(randomUUID());
    }).toThrow(TypeError);
  });

  it('rejects an incomplete quiz with readiness fields and leaves the owner free to retry', async () => {
    const draft = await request(server)
      .post('/quizzes')
      .auth(token, { type: 'bearer' })
      .send({})
      .expect(201);
    const quizId = (draft.body as { id: string }).id;
    const requestId = randomUUID();
    const response = await request(server)
      .post('/rooms')
      .auth(token, { type: 'bearer' })
      .send({ quizId, requestId })
      .expect(400);
    expect(response.body).toMatchObject({
      code: 'QUIZ_NOT_HOSTABLE',
      fields: [
        { field: 'title', code: 'REQUIRED', message: 'Title is required' },
        {
          field: 'questions',
          code: 'QUESTION_COUNT',
          message: 'Quiz must contain 1–20 questions',
        },
      ],
    });
    await request(server)
      .put(`/quizzes/${quizId}`)
      .auth(token, { type: 'bearer' })
      .send({ title: 'Ready', questions: [question('Ready?')] })
      .expect(200);
    await request(server)
      .post('/rooms')
      .auth(token, { type: 'bearer' })
      .send({ quizId, requestId })
      .expect(201);
  });

  it('does not reveal a foreign quiz through room creation', async () => {
    const { quizId } = await hostableQuiz();
    const otherToken = await login('other-room-owner@example.com');
    const response = await request(server)
      .post('/rooms')
      .auth(otherToken, { type: 'bearer' })
      .send({ quizId, requestId: randomUUID() })
      .expect(404);
    expect(response.body).toEqual({
      statusCode: 404,
      code: 'QUIZ_NOT_FOUND',
      message: 'Quiz not found',
    });
  });

  it('does not grant admins a foreign quiz hosting bypass', async () => {
    const { quizId } = await hostableQuiz();
    const admin = await login('room-admin@example.com', true);
    await request(server)
      .post('/rooms')
      .auth(admin, { type: 'bearer' })
      .send({ quizId, requestId: randomUUID() })
      .expect(404);
  });

  it('returns the same not-found error for a missing quiz', async () => {
    const response = await request(server)
      .post('/rooms')
      .auth(token, { type: 'bearer' })
      .send({ quizId: randomUUID(), requestId: randomUUID() })
      .expect(404);
    expect(response.body).toEqual({
      statusCode: 404,
      code: 'QUIZ_NOT_FOUND',
      message: 'Quiz not found',
    });
  });

  it('binds the private host to the authenticated account', async () => {
    const { quizId } = await hostableQuiz();
    const response = await request(server)
      .post('/rooms')
      .auth(token, { type: 'bearer' })
      .send({ quizId, requestId: randomUUID() })
      .expect(201);
    const owner = await db
      .selectFrom('users')
      .select('id')
      .where('email', '=', 'room-owner@example.com')
      .executeTakeFirstOrThrow();
    const room = app
      .get<RoomStorePort>(ROOM_STORE_PORT)
      .findById((response.body as { roomId: string }).roomId)!;
    expect(room.host).toEqual({ ownerId: owner.id });
    expect(Object.isFrozen(room.host)).toBe(true);
  });

  it('replays an acknowledged request after its source quiz is deleted', async () => {
    const { quizId } = await hostableQuiz();
    const input = { quizId, requestId: randomUUID() };
    const first = await request(server)
      .post('/rooms')
      .auth(token, { type: 'bearer' })
      .send(input)
      .expect(201);
    await request(server)
      .delete(`/quizzes/${quizId}`)
      .auth(token, { type: 'bearer' })
      .expect(204);
    const retry = await request(server)
      .post('/rooms')
      .auth(token, { type: 'bearer' })
      .send(input)
      .expect(201);
    expect(retry.body).toEqual(first.body);
  });

  it('rejects another active room without changing the first snapshot', async () => {
    const { quizId } = await hostableQuiz();
    const first = await request(server)
      .post('/rooms')
      .auth(token, { type: 'bearer' })
      .send({ quizId, requestId: randomUUID() })
      .expect(201);
    const second = await request(server)
      .post('/rooms')
      .auth(token, { type: 'bearer' })
      .send({ quizId, requestId: randomUUID() })
      .expect(409);
    expect(second.body).toEqual({
      statusCode: 409,
      code: 'OWNER_HAS_ACTIVE_ROOM',
      message: 'Owner already has an active room',
    });
    expect(
      app
        .get<RoomStorePort>(ROOM_STORE_PORT)
        .findById((first.body as { roomId: string }).roomId),
    ).not.toBeNull();
  });

  it('rejects reusing a creation request ID for a different quiz', async () => {
    const { quizId } = await hostableQuiz();
    const requestId = randomUUID();
    await request(server)
      .post('/rooms')
      .auth(token, { type: 'bearer' })
      .send({ quizId, requestId })
      .expect(201);
    const response = await request(server)
      .post('/rooms')
      .auth(token, { type: 'bearer' })
      .send({ quizId: randomUUID(), requestId })
      .expect(409);
    expect(response.body).toMatchObject({ code: 'CREATION_REQUEST_CONFLICT' });
  });

  it('coalesces concurrent HTTP retries into the same room', async () => {
    await withCommittedQuiz(async (server, token, quizId) => {
      const input = { quizId, requestId: randomUUID() };
      const responses = await Promise.all(
        Array.from({ length: 4 }, () =>
          request(server)
            .post('/rooms')
            .auth(token, { type: 'bearer' })
            .send(input)
            .expect(201),
        ),
      );
      expect(responses.map((response) => response.body as unknown)).toEqual(
        Array(4).fill(responses[0].body),
      );
    });
  });

  it('allows only one of two distinct concurrent HTTP creation requests', async () => {
    await withCommittedQuiz(async (server, token, quizId) => {
      const responses = await Promise.all(
        Array.from({ length: 2 }, () =>
          request(server)
            .post('/rooms')
            .auth(token, { type: 'bearer' })
            .send({ quizId, requestId: randomUUID() }),
        ),
      );
      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 409,
      ]);
    });
  });

  // Concurrent requests use committed fixtures and normal pool checkout, rather
  // than sharing the rollback harness's single borrowed PostgreSQL client.
  async function withCommittedQuiz(
    run: (server: Server, token: string, quizId: string) => Promise<void>,
  ) {
    const independent = await createTestApp({ validation: true });
    const independentServer = independent.app.getHttpServer() as Server;
    const email = `room-concurrency-${randomUUID()}@example.com`;
    const credentials = { email, password: 'TestPassword123!' };
    try {
      await request(independentServer)
        .post('/auth/register')
        .send(credentials)
        .expect(201);
      const login = await request(independentServer)
        .post('/auth/login')
        .send(credentials)
        .expect(200);
      const independentToken = (login.body as { accessToken: string })
        .accessToken;
      const draft = await request(independentServer)
        .post('/quizzes')
        .auth(independentToken, { type: 'bearer' })
        .send({})
        .expect(201);
      const quizId = (draft.body as { id: string }).id;
      await request(independentServer)
        .put(`/quizzes/${quizId}`)
        .auth(independentToken, { type: 'bearer' })
        .send({ title: 'Concurrency', questions: [question('Ready?')] })
        .expect(200);
      await run(independentServer, independentToken, quizId);
    } finally {
      const owner = await independent.db
        .selectFrom('users')
        .select('id')
        .where('email', '=', email)
        .executeTakeFirst();
      if (owner) {
        await independent.db
          .deleteFrom('quizzes')
          .where('owner_id', '=', owner.id)
          .execute();
        await independent.db
          .deleteFrom('users')
          .where('id', '=', owner.id)
          .execute();
      }
      await destroyTestApp(independent.app, independent.db);
    }
  }

  it.each([
    ['missing quiz ID', { requestId: randomUUID() }],
    ['missing request ID', { quizId: randomUUID() }],
    ['malformed quiz ID', { quizId: 'bad', requestId: randomUUID() }],
    ['malformed request ID', { quizId: randomUUID(), requestId: 'bad' }],
    [
      'owner injection',
      { quizId: randomUUID(), requestId: randomUUID(), ownerId: randomUUID() },
    ],
    [
      'host injection',
      {
        quizId: randomUUID(),
        requestId: randomUUID(),
        host: { ownerId: randomUUID() },
      },
    ],
    ['array body', []],
  ])('rejects %s', async (_name, input) => {
    await request(server)
      .post('/rooms')
      .auth(token, { type: 'bearer' })
      .send(input)
      .expect(400);
  });

  it('rejects missing account credentials', async () => {
    await request(server)
      .post('/rooms')
      .send({ quizId: randomUUID(), requestId: randomUUID() })
      .expect(401);
  });

  it('rejects invalid account credentials', async () => {
    await request(server)
      .post('/rooms')
      .auth('invalid', { type: 'bearer' })
      .send({ quizId: randomUUID(), requestId: randomUUID() })
      .expect(401);
  });

  it('rejects expired account credentials', async () => {
    const claims = new JwtService().decode<Record<string, unknown>>(token);
    delete claims.iat;
    delete claims.exp;
    const expired = new JwtService({ secret: process.env.JWT_SECRET }).sign(
      claims,
      { expiresIn: -1 },
    );
    await request(server)
      .post('/rooms')
      .auth(expired, { type: 'bearer' })
      .send({ quizId: randomUUID(), requestId: randomUUID() })
      .expect(401);
  });

  it('rejects revoked credentials even on a creation retry', async () => {
    const { quizId } = await hostableQuiz();
    const input = { quizId, requestId: randomUUID() };
    await request(server)
      .post('/rooms')
      .auth(token, { type: 'bearer' })
      .send(input)
      .expect(201);
    await request(server)
      .post('/auth/logout')
      .auth(token, { type: 'bearer' })
      .expect(200);
    await request(server)
      .post('/rooms')
      .auth(token, { type: 'bearer' })
      .send(input)
      .expect(401);
  });

  it('publishes the implemented creation response in OpenAPI', async () => {
    const { quizId } = await hostableQuiz();
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const operation = document.paths['/rooms'].post!;
    const body = operation.requestBody;
    if (!body || !('content' in body))
      throw new Error('Missing creation request');
    const requestExample = body.content['application/json'].examples!.create;
    if (!('value' in requestExample))
      throw new Error('Missing creation request example');
    expect(requestExample.value).toEqual(CREATE_ROOM_EXAMPLE);
    const response = await request(server)
      .post('/rooms')
      .auth(token, { type: 'bearer' })
      .send({ ...(requestExample.value as Record<string, unknown>), quizId })
      .expect(201);
    const created = operation.responses['201'];
    if (!created || !('content' in created))
      throw new Error('Missing documented room creation response');
    const example = created.content!['application/json'].example as Record<
      string,
      unknown
    >;
    expect(response.body).toEqual({
      ...example,
      roomId: expect.any(String) as unknown,
      pin: expect.stringMatching(/^\d{6}$/) as unknown,
      createdAt: expect.any(String) as unknown,
    });
    expect(operation.security).toEqual([{ bearer: [] }]);
    expect(Object.keys(operation.responses).sort()).toEqual([
      '201',
      '400',
      '401',
      '404',
      '409',
      '503',
    ]);
    const contract = readFileSync(
      join(__dirname, '../docs/contracts/room-creation.md'),
      'utf8',
    );
    const examples = [...contract.matchAll(/```json\n([\s\S]*?)\n```/g)].map(
      (match) => JSON.parse(match[1]) as unknown,
    );
    expect(examples).toEqual([
      CREATE_ROOM_EXAMPLE,
      ROOM_CREATED_EXAMPLE,
      ROOM_NOT_HOSTABLE_EXAMPLE,
      ROOM_ACTIVE_EXAMPLE,
    ]);
  });
});
