import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Server } from 'net';
import { Kysely, sql } from 'kysely';
import request from 'supertest';
import { Database } from '../src/database/database.types';
import {
  createTestApp,
  beginTransaction,
  rollbackTransaction,
  destroyTestApp,
} from './helpers/setup-test-app';
import { TestPool } from './helpers/test-pool';
import { JwtService } from '@nestjs/jwt';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';

describe('Private quiz drafts (HTTP + PostgreSQL)', () => {
  let app: INestApplication;
  let pool: TestPool;
  let db: Kysely<Database>;
  let server: Server;
  let token: string;

  function documentedExample(
    operation: NonNullable<OpenAPIObject['paths'][string]['get']>,
    status: string,
  ): unknown {
    const response = operation.responses[status];
    if (!('content' in response)) throw new Error('Missing response content');
    const media = response.content?.['application/json'];
    const schema = media?.schema;
    return (
      media?.example ??
      (schema && 'example' in schema ? schema.example : undefined)
    );
  }

  beforeAll(async () => {
    if (!process.env.DB_NAME?.endsWith('_test')) {
      throw new Error(
        'Quiz integration tests require an explicit dedicated *_test database',
      );
    }
    ({ app, pool, db } = await createTestApp({ validation: true }));
    server = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await beginTransaction(pool);
    await request(server)
      .post('/auth/register')
      .send({ email: 'quiz-owner@example.com', password: 'TestPassword123!' })
      .expect(201);
    const login = await request(server)
      .post('/auth/login')
      .send({ email: 'quiz-owner@example.com', password: 'TestPassword123!' })
      .expect(200);
    token = (login.body as { accessToken: string }).accessToken;
  });

  afterEach(async () => rollbackTransaction(pool));
  afterAll(async () => {
    if (app) await destroyTestApp(app, db);
  });

  it('creates an empty draft with field-specific readiness errors', async () => {
    const response = await request(server)
      .post('/quizzes')
      .auth(token, { type: 'bearer' })
      .send({})
      .expect(201);
    expect(response.body).toEqual({
      id: expect.any(String) as unknown,
      title: '',
      questions: [],
      createdAt: expect.any(String) as unknown,
      updatedAt: expect.any(String) as unknown,
      hostable: false,
      errors: [
        { field: 'title', code: 'REQUIRED', message: 'Title is required' },
        {
          field: 'questions',
          code: 'QUESTION_COUNT',
          message: 'Quiz must contain 1–20 questions',
        },
      ],
    });
  });

  it('reopens the persisted draft in a later HTTP request', async () => {
    const created = await request(server)
      .post('/quizzes')
      .auth(token, { type: 'bearer' })
      .send({})
      .expect(201);
    const id = (created.body as { id: string }).id;
    const reopened = await request(server)
      .get(`/quizzes/${id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(reopened.body).toEqual(created.body);
  });

  async function loginAs(
    email: string,
    roles: ('user' | 'admin')[] = ['user'],
  ) {
    await request(server)
      .post('/auth/register')
      .send({ email, password: 'TestPassword123!' })
      .expect(201);
    if (roles.includes('admin'))
      await db
        .updateTable('users')
        .set({ roles: sql`${JSON.stringify(roles)}::jsonb` })
        .where('email', '=', email)
        .execute();
    const login = await request(server)
      .post('/auth/login')
      .send({ email, password: 'TestPassword123!' })
      .expect(200);
    return (login.body as { accessToken: string }).accessToken;
  }

  it('lists only the current owner’s draft summaries', async () => {
    const created = await request(server)
      .post('/quizzes')
      .auth(token, { type: 'bearer' })
      .send({})
      .expect(201);
    const other = await loginAs('other@example.com');
    await request(server)
      .post('/quizzes')
      .auth(other, { type: 'bearer' })
      .send({})
      .expect(201);
    const list = await request(server)
      .get('/quizzes')
      .auth(token, { type: 'bearer' })
      .expect(200);
    const draft = created.body as {
      id: string;
      createdAt: string;
      updatedAt: string;
    };
    expect(list.body).toEqual([
      {
        id: draft.id,
        title: '',
        questionCount: 0,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
        hostable: false,
      },
    ]);
  });

  it.each([['user'], ['admin']] as const)(
    'denies foreign draft reads to a %s',
    async (role) => {
      const created = await request(server)
        .post('/quizzes')
        .auth(token, { type: 'bearer' })
        .send({})
        .expect(201);
      const other = await loginAs(`${role}@example.com`, [role]);
      const response = await request(server)
        .get(`/quizzes/${(created.body as { id: string }).id}`)
        .auth(other, { type: 'bearer' })
        .expect(404);
      expect(response.body).toEqual({
        statusCode: 404,
        message: 'Quiz not found',
        error: 'Not Found',
      });
    },
  );

  it.each(['create', 'list', 'read'])(
    'rejects unauthenticated %s requests',
    async (action) => {
      const response =
        action === 'create'
          ? await request(server).post('/quizzes').send({}).expect(401)
          : await request(server)
              .get(
                action === 'list'
                  ? '/quizzes'
                  : '/quizzes/00000000-0000-4000-8000-000000000000',
              )
              .expect(401);
      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      });
    },
  );

  it('rejects expired credentials', async () => {
    const owner = await db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', 'quiz-owner@example.com')
      .executeTakeFirstOrThrow();
    const expired = new JwtService({ secret: process.env.JWT_SECRET }).sign(
      {
        sub: owner.id,
        email: owner.email,
        roles: owner.roles,
        tokenVersion: owner.token_version,
      },
      { expiresIn: -1 },
    );
    const response = await request(server)
      .get('/quizzes')
      .auth(expired, { type: 'bearer' })
      .expect(401);
    expect(response.body).toEqual({
      statusCode: 401,
      message: 'Unauthorized',
      error: 'Unauthorized',
    });
  });

  it('rejects an invalid bearer token', async () => {
    await request(server)
      .post('/quizzes')
      .auth('invalid', { type: 'bearer' })
      .send({})
      .expect(401);
  });

  it('returns the same 404 for a missing quiz', async () => {
    const response = await request(server)
      .get('/quizzes/00000000-0000-4000-8000-000000000000')
      .auth(token, { type: 'bearer' })
      .expect(404);
    expect(response.body).toEqual({
      statusCode: 404,
      message: 'Quiz not found',
      error: 'Not Found',
    });
  });

  it('rejects malformed quiz identifiers', async () => {
    await request(server)
      .get('/quizzes/not-a-uuid')
      .auth(token, { type: 'bearer' })
      .expect(400);
  });

  it('rejects caller-supplied ownership', async () => {
    const response = await request(server)
      .post('/quizzes')
      .auth(token, { type: 'bearer' })
      .send({ ownerId: 'someone-else' })
      .expect(400);
    expect(response.body).toEqual({
      statusCode: 400,
      message: ['property ownerId should not exist'],
      error: 'Bad Request',
    });
    const list = await request(server)
      .get('/quizzes')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(list.body).toEqual([]);
  });

  it('persists an incomplete title draft and reports missing questions', async () => {
    const created = await request(server)
      .post('/quizzes')
      .auth(token, { type: 'bearer' })
      .send({ title: 'Biology' })
      .expect(201);
    expect(created.body).toMatchObject({
      title: 'Biology',
      hostable: false,
      errors: [
        {
          field: 'questions',
          code: 'QUESTION_COUNT',
          message: 'Quiz must contain 1–20 questions',
        },
      ],
    });
    const read = await request(server)
      .get(`/quizzes/${(created.body as { id: string }).id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(read.body).toEqual(created.body);
  });

  it.each([
    { title: null },
    { title: 42 },
    { title: 'x'.repeat(201) },
    { questions: 'not-an-array' },
    { questions: [] },
  ])(
    'rejects malformed or unsupported draft input %j without creating a quiz',
    async (input) => {
      await request(server)
        .post('/quizzes')
        .auth(token, { type: 'bearer' })
        .send(input)
        .expect(400);
      const list = await request(server)
        .get('/quizzes')
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(list.body).toEqual([]);
    },
  );

  it('treats a whitespace title as an incomplete saved draft', async () => {
    const created = await request(server)
      .post('/quizzes')
      .auth(token, { type: 'bearer' })
      .send({ title: '  ' })
      .expect(201);
    expect(created.body).toMatchObject({
      title: '  ',
      hostable: false,
      errors: expect.arrayContaining([
        { field: 'title', code: 'REQUIRED', message: 'Title is required' },
      ]) as unknown,
    });
  });

  it('creates an empty draft when the optional request body is omitted', async () => {
    const created = await request(server)
      .post('/quizzes')
      .auth(token, { type: 'bearer' })
      .expect(201);
    expect(created.body).toMatchObject({
      title: '',
      questions: [],
      hostable: false,
    });
  });

  it.each([{ body: [] }, { body: [{}] }])(
    'rejects an array request body $body',
    async ({ body }) => {
      await request(server)
        .post('/quizzes')
        .auth(token, { type: 'bearer' })
        .send(body)
        .expect(400);
      const list = await request(server)
        .get('/quizzes')
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(list.body).toEqual([]);
    },
  );

  it('rejects a credential revoked through logout', async () => {
    await request(server)
      .post('/auth/logout')
      .auth(token, { type: 'bearer' })
      .expect(200);
    await request(server)
      .get('/quizzes')
      .auth(token, { type: 'bearer' })
      .expect(401);
  });

  it('publishes success examples matching the create/list/read transport', async () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const create = document.paths['/quizzes'].post!;
    const read = document.paths['/quizzes/{id}'].get!;
    const list = document.paths['/quizzes'].get!;
    expect(create.security).toEqual([{ bearer: [] }]);
    expect(read.security).toEqual([{ bearer: [] }]);
    expect(list.security).toEqual([{ bearer: [] }]);
    expect(document.components?.schemas?.CreateQuizDto).toMatchObject({
      properties: { title: { type: 'string', maxLength: 200, default: '' } },
    });
    const response = await request(server)
      .post('/quizzes')
      .auth(token, { type: 'bearer' })
      .send({})
      .expect(201);
    const body = response.body as {
      id: string;
      createdAt: string;
      updatedAt: string;
    };
    const dynamicFields = {
      id: body.id,
      createdAt: body.createdAt,
      updatedAt: body.updatedAt,
    };
    expect(body).toEqual({
      ...(documentedExample(create, '201') as object),
      ...dynamicFields,
    });
    expect(body).toEqual({
      ...(documentedExample(read, '200') as object),
      ...dynamicFields,
    });
    const summaries = await request(server)
      .get('/quizzes')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(summaries.body).toEqual(
      (documentedExample(list, '200') as object[]).map((example) => ({
        ...example,
        ...dynamicFields,
      })),
    );
  });

  it('publishes error examples matching the HTTP responses', async () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const create = document.paths['/quizzes'].post!;
    const read = document.paths['/quizzes/{id}'].get!;
    const unauthenticated = await request(server)
      .post('/quizzes')
      .send({})
      .expect(401);
    expect(unauthenticated.body).toEqual(documentedExample(create, '401'));
    const invalid = await request(server)
      .post('/quizzes')
      .auth(token, { type: 'bearer' })
      .send({ ownerId: 'forged' })
      .expect(400);
    expect(invalid.body).toEqual(documentedExample(create, '400'));
    const missing = await request(server)
      .get('/quizzes/00000000-0000-4000-8000-000000000000')
      .auth(token, { type: 'bearer' })
      .expect(404);
    expect(missing.body).toEqual(documentedExample(read, '404'));
    const invalidId = await request(server)
      .get('/quizzes/not-a-uuid')
      .auth(token, { type: 'bearer' })
      .expect(400);
    expect(invalidId.body).toEqual(documentedExample(read, '400'));
  });

  it('reopens a committed draft from an independent application instance', async () => {
    await rollbackTransaction(pool);
    const email = 'quiz-durable@example.com';
    let second: Awaited<ReturnType<typeof createTestApp>> | undefined;
    try {
      const durableToken = await loginAs(email);
      const created = await request(server)
        .post('/quizzes')
        .auth(durableToken, { type: 'bearer' })
        .send({ title: 'Durable draft' })
        .expect(201);
      second = await createTestApp({ validation: true });
      const read = await request(second.app.getHttpServer() as Server)
        .get(`/quizzes/${(created.body as { id: string }).id}`)
        .auth(durableToken, { type: 'bearer' })
        .expect(200);
      expect(read.body).toEqual(created.body);
    } finally {
      if (second) await destroyTestApp(second.app, second.db);
      const owner = await db
        .selectFrom('users')
        .select('id')
        .where('email', '=', email)
        .executeTakeFirst();
      if (owner) {
        await db
          .deleteFrom('quizzes')
          .where('owner_id', '=', owner.id)
          .execute();
        await db.deleteFrom('users').where('id', '=', owner.id).execute();
      }
    }
  });
});
