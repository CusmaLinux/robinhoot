import 'dotenv/config';
import { randomUUID } from 'crypto';
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

  afterEach(async () => {
    if (pool) await rollbackTransaction(pool);
  });
  afterAll(async () => {
    if (app) await destroyTestApp(app, db);
  });

  function question(prompt = 'Which cell contains a nucleus?') {
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

  async function createDraft() {
    const response = await request(server)
      .post('/quizzes')
      .auth(token, { type: 'bearer' })
      .send({})
      .expect(201);
    return response.body as {
      id: string;
      createdAt: string;
      updatedAt: string;
    };
  }

  it('deletes an owned saved quiz from subsequent retrieval and listing', async () => {
    const draft = await createDraft();
    const retained = await createDraft();
    await request(server)
      .put(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .send({ title: 'Delete me', questions: [question()] })
      .expect(200);
    const deleted = await request(server)
      .delete(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204);
    expect(deleted.text).toBe('');
    await request(server)
      .get(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .expect(404);
    const list = await request(server)
      .get('/quizzes')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(list.body).toEqual([expect.objectContaining({ id: retained.id })]);
  });

  it.each([['user'], ['admin']] as const)(
    'denies foreign quiz deletion to a %s without mutation',
    async (role) => {
      const draft = await createDraft();
      const saved = await request(server)
        .put(`/quizzes/${draft.id}`)
        .auth(token, { type: 'bearer' })
        .send({ title: 'Private quiz', questions: [question()] })
        .expect(200);
      const other = await loginAs(`delete-${role}@example.com`, [role]);
      const denied = await request(server)
        .delete(`/quizzes/${draft.id}`)
        .auth(other, { type: 'bearer' })
        .expect(404);
      expect(denied.body).toEqual({
        statusCode: 404,
        message: 'Quiz not found',
        error: 'Not Found',
      });
      const read = await request(server)
        .get(`/quizzes/${draft.id}`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(read.body).toEqual(saved.body);
    },
  );

  it('returns the same 404 when deleting a missing or already deleted quiz', async () => {
    const draft = await createDraft();
    await request(server)
      .delete(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204);
    for (const id of [draft.id, randomUUID()]) {
      const response = await request(server)
        .delete(`/quizzes/${id}`)
        .auth(token, { type: 'bearer' })
        .expect(404);
      expect(response.body).toEqual({
        statusCode: 404,
        message: 'Quiz not found',
        error: 'Not Found',
      });
    }
  });

  it.each(['missing', 'invalid', 'expired', 'revoked'])(
    'rejects deletion with %s credentials without mutation',
    async (credential) => {
      const draft = await createDraft();
      const owner = await db
        .selectFrom('users')
        .selectAll()
        .where('email', '=', 'quiz-owner@example.com')
        .executeTakeFirstOrThrow();
      let supplied = token;
      if (credential === 'invalid') supplied = 'invalid';
      if (credential === 'expired') {
        supplied = new JwtService({ secret: process.env.JWT_SECRET }).sign(
          {
            sub: owner.id,
            email: owner.email,
            roles: owner.roles,
            tokenVersion: owner.token_version,
          },
          { expiresIn: -1 },
        );
      }
      if (credential === 'revoked') {
        await request(server)
          .post('/auth/logout')
          .auth(token, { type: 'bearer' })
          .expect(200);
      }
      const deletion = request(server).delete(`/quizzes/${draft.id}`);
      if (credential !== 'missing') deletion.auth(supplied, { type: 'bearer' });
      const denied = await deletion.expect(401);
      expect(denied.body).toEqual({
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      });
      const login = await request(server)
        .post('/auth/login')
        .send({ email: owner.email, password: 'TestPassword123!' })
        .expect(200);
      const read = await request(server)
        .get(`/quizzes/${draft.id}`)
        .auth((login.body as { accessToken: string }).accessToken, {
          type: 'bearer',
        })
        .expect(200);
      expect(read.body).toMatchObject(draft);
    },
  );

  it('rejects malformed deletion identifiers without changing the saved list', async () => {
    await createDraft();
    const before = await request(server)
      .get('/quizzes')
      .auth(token, { type: 'bearer' })
      .expect(200);
    const response = await request(server)
      .delete('/quizzes/not-a-uuid')
      .auth(token, { type: 'bearer' })
      .expect(400);
    expect(response.body).toEqual({
      statusCode: 400,
      message: 'Validation failed (uuid is expected)',
      error: 'Bad Request',
    });
    const after = await request(server)
      .get('/quizzes')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(after.body).toEqual(before.body);
  });

  it('keeps deletion committed across independent application instances', async () => {
    await rollbackTransaction(pool);
    const email = `quiz-deletion-${randomUUID()}@example.com`;
    let second: Awaited<ReturnType<typeof createTestApp>> | undefined;
    try {
      const durableToken = await loginAs(email);
      const created = await request(server)
        .post('/quizzes')
        .auth(durableToken, { type: 'bearer' })
        .send({ title: 'Durable deletion' })
        .expect(201);
      const path = `/quizzes/${(created.body as { id: string }).id}`;
      second = await createTestApp({ validation: true });
      const secondServer = second.app.getHttpServer() as Server;
      await request(secondServer)
        .get(path)
        .auth(durableToken, { type: 'bearer' })
        .expect(200);
      await request(server)
        .delete(path)
        .auth(durableToken, { type: 'bearer' })
        .expect(204);
      await request(secondServer)
        .get(path)
        .auth(durableToken, { type: 'bearer' })
        .expect(404);
      const list = await request(secondServer)
        .get('/quizzes')
        .auth(durableToken, { type: 'bearer' })
        .expect(200);
      expect(list.body).toEqual([]);
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

  it('publishes deletion status codes and examples matching HTTP responses', async () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const deletion = document.paths['/quizzes/{id}'].delete!;
    expect(deletion.security).toEqual([{ bearer: [] }]);
    expect(deletion.responses['204']).toEqual({
      description: 'Owned quiz deleted; empty response body',
    });
    const draft = await createDraft();
    const path = `/quizzes/${draft.id}`;
    const unauthorized = await request(server).delete(path).expect(401);
    expect(unauthorized.body).toEqual(documentedExample(deletion, '401'));
    const invalid = await request(server)
      .delete('/quizzes/not-a-uuid')
      .auth(token, { type: 'bearer' })
      .expect(400);
    expect(invalid.body).toEqual(documentedExample(deletion, '400'));
    await request(server)
      .delete(path)
      .auth(token, { type: 'bearer' })
      .expect(204);
    const missing = await request(server)
      .delete(path)
      .auth(token, { type: 'bearer' })
      .expect(404);
    expect(missing.body).toEqual(documentedExample(deletion, '404'));
  });

  it('completes the two-question authoring walkthrough with a private second account boundary', async () => {
    const draft = await createDraft();
    const path = `/quizzes/${draft.id}`;
    const first = question('Which cell contains a nucleus?');
    const second = question('Which cell is eukaryotic?');
    const saved = await request(server)
      .put(path)
      .auth(token, { type: 'bearer' })
      .send({ title: 'Biology', questions: [first, second] })
      .expect(200);
    expect(saved.body).toMatchObject({ hostable: true, errors: [] });
    const edited = {
      ...first,
      prompt: 'Which cell has a membrane-bound nucleus?',
    };
    const reordered = await request(server)
      .put(path)
      .auth(token, { type: 'bearer' })
      .send({ title: 'Biology revision', questions: [second, edited] })
      .expect(200);
    expect(reordered.body).toMatchObject({
      questions: [second, edited],
      hostable: true,
      errors: [],
    });
    const other = await loginAs('walkthrough-other@example.com');
    const otherList = await request(server)
      .get('/quizzes')
      .auth(other, { type: 'bearer' })
      .expect(200);
    expect(otherList.body).toEqual([]);
    await request(server).get(path).auth(other, { type: 'bearer' }).expect(404);
    await request(server)
      .put(path)
      .auth(other, { type: 'bearer' })
      .send({ title: 'Foreign edit', questions: [] })
      .expect(404);
    await request(server)
      .delete(path)
      .auth(other, { type: 'bearer' })
      .expect(404);
    const reopened = await request(server)
      .get(path)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(reopened.body).toEqual(reordered.body);
    await request(server)
      .delete(path)
      .auth(token, { type: 'bearer' })
      .expect(204);
    await request(server).get(path).auth(token, { type: 'bearer' }).expect(404);
    const list = await request(server)
      .get('/quizzes')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(list.body).toEqual([]);
  });

  it('saves title and stable question/option identities for a subsequent read', async () => {
    const draft = await createDraft();
    const input = { title: ' Biology ', questions: [question()] };
    const saved = await request(server)
      .put(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .send(input)
      .expect(200);
    expect(saved.body).toMatchObject({
      ...input,
      id: draft.id,
      createdAt: draft.createdAt,
    });
    const read = await request(server)
      .get(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(read.body).toEqual(saved.body);
  });

  it('saves incomplete content with field-specific readiness errors', async () => {
    const draft = await createDraft();
    const input = {
      title: '  ',
      questions: [
        {
          ...question(),
          prompt: '',
          options: [],
          correctOptionIds: [],
          durationSeconds: null,
        },
      ],
    };
    const saved = await request(server)
      .put(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .send(input)
      .expect(200);
    expect(saved.body).toMatchObject({
      ...input,
      hostable: false,
      errors: [
        { field: 'title', code: 'REQUIRED', message: 'Title is required' },
        {
          field: 'questions[0].prompt',
          code: 'REQUIRED',
          message: 'Prompt is required',
        },
        {
          field: 'questions[0].options',
          code: 'OPTION_COUNT',
          message: 'Question must contain four options',
        },
        {
          field: 'questions[0].correctOptionIds',
          code: 'CORRECT_OPTION_COUNT',
          message: 'Question must have exactly one correct option',
        },
        {
          field: 'questions[0].durationSeconds',
          code: 'DURATION',
          message: 'Duration must be 10, 20, 30, or 60 seconds',
        },
      ],
    });
    const read = await request(server)
      .get(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(read.body).toEqual(saved.body);
  });

  it('reorders two questions and their options without changing identities or correct mappings', async () => {
    const draft = await createDraft();
    const a = question('Question A');
    const b = question('Question B');
    await request(server)
      .put(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .send({ title: 'Two questions', questions: [a, b] })
      .expect(200);
    const input = {
      title: 'Reordered',
      questions: [
        {
          ...b,
          prompt: 'Edited B',
          options: [...b.options].reverse(),
          durationSeconds: 60,
        },
        a,
      ],
    };
    const saved = await request(server)
      .put(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .send(input)
      .expect(200);
    expect(saved.body).toMatchObject({ ...input, hostable: true, errors: [] });
    const read = await request(server)
      .get(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(read.body).toEqual(saved.body);
    const list = await request(server)
      .get('/quizzes')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(list.body).toEqual([
      {
        id: draft.id,
        title: input.title,
        questionCount: 2,
        createdAt: draft.createdAt,
        updatedAt: (saved.body as { updatedAt: string }).updatedAt,
        hostable: true,
      },
    ]);
  });

  it('rejects duplicate question identities without partially replacing saved content', async () => {
    const draft = await createDraft();
    const original = { title: 'Original', questions: [question()] };
    const saved = await request(server)
      .put(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .send(original)
      .expect(200);
    await request(server)
      .put(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .send({
        title: 'Changed',
        questions: [original.questions[0], original.questions[0]],
      })
      .expect(400);
    const read = await request(server)
      .get(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(read.body).toEqual(saved.body);
  });

  it('rejects duplicate option identities without changing the draft', async () => {
    const draft = await createDraft();
    const q = question();
    q.options[1].id = q.options[0].id;
    await request(server)
      .put(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .send({ title: 'Changed', questions: [q] })
      .expect(400);
    const read = await request(server)
      .get(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(read.body).toMatchObject({
      title: '',
      questions: [],
      updatedAt: draft.updatedAt,
    });
  });

  it('rejects a correct answer referring to an option outside its question', async () => {
    const draft = await createDraft();
    const q = question();
    q.correctOptionIds = [randomUUID()];
    await request(server)
      .put(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .send({ title: 'Changed', questions: [q] })
      .expect(400);
    const read = await request(server)
      .get(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(read.body).toMatchObject({
      title: '',
      questions: [],
      updatedAt: draft.updatedAt,
    });
  });

  it('rejects repeated correct-option IDs as malformed structure', async () => {
    const draft = await createDraft();
    const q = question();
    q.correctOptionIds.push(q.correctOptionIds[0]);
    await request(server)
      .put(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .send({ title: 'Changed', questions: [q] })
      .expect(400);
    const read = await request(server)
      .get(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(read.body).toMatchObject({
      title: '',
      questions: [],
      updatedAt: draft.updatedAt,
    });
  });

  it.each([['user'], ['admin']] as const)(
    'denies foreign edits and reorders to a %s without changing content',
    async (role) => {
      const draft = await createDraft();
      const input = {
        title: 'Owner quiz',
        questions: [question('A'), question('B')],
      };
      const saved = await request(server)
        .put(`/quizzes/${draft.id}`)
        .auth(token, { type: 'bearer' })
        .send(input)
        .expect(200);
      const other = await loginAs(`edit-${role}@example.com`, [role]);
      const denied = await request(server)
        .put(`/quizzes/${draft.id}`)
        .auth(other, { type: 'bearer' })
        .send({ title: 'Stolen', questions: [...input.questions].reverse() })
        .expect(404);
      expect(denied.body).toEqual({
        statusCode: 404,
        message: 'Quiz not found',
        error: 'Not Found',
      });
      const read = await request(server)
        .get(`/quizzes/${draft.id}`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(read.body).toEqual(saved.body);
    },
  );

  it.each(['missing', 'invalid', 'expired', 'revoked'])(
    'rejects %s credentials on save without changing content',
    async (credential) => {
      const draft = await createDraft();
      let saveToken = token;
      if (credential === 'invalid') saveToken = 'invalid';
      if (credential === 'expired') {
        const claims = new JwtService().decode<Record<string, unknown>>(token);
        delete claims.iat;
        delete claims.exp;
        saveToken = new JwtService({ secret: process.env.JWT_SECRET }).sign(
          claims,
          { expiresIn: -1 },
        );
      }
      if (credential === 'revoked') {
        await request(server)
          .post('/auth/logout')
          .auth(token, { type: 'bearer' })
          .expect(200);
      }
      const save = request(server).put(`/quizzes/${draft.id}`);
      if (credential !== 'missing') save.auth(saveToken, { type: 'bearer' });
      await save
        .send({ title: 'Changed', questions: [question()] })
        .expect(401);
      if (credential === 'revoked') {
        const login = await request(server)
          .post('/auth/login')
          .send({
            email: 'quiz-owner@example.com',
            password: 'TestPassword123!',
          })
          .expect(200);
        token = (login.body as { accessToken: string }).accessToken;
      }
      const read = await request(server)
        .get(`/quizzes/${draft.id}`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(read.body).toMatchObject({
        title: '',
        questions: [],
        updatedAt: draft.updatedAt,
      });
    },
  );

  it('uses the same missing-resource response on save and validates path UUIDs', async () => {
    const input = { title: 'Missing', questions: [] };
    const missing = await request(server)
      .put('/quizzes/00000000-0000-4000-8000-000000000000')
      .auth(token, { type: 'bearer' })
      .send(input)
      .expect(404);
    expect(missing.body).toEqual({
      statusCode: 404,
      message: 'Quiz not found',
      error: 'Not Found',
    });
    await request(server)
      .put('/quizzes/not-a-uuid')
      .auth(token, { type: 'bearer' })
      .send(input)
      .expect(400);
  });

  const invalidSaves: [string, () => unknown][] = [
    ['missing title', () => ({ questions: [] })],
    ['null title', () => ({ title: null, questions: [] })],
    ['long title', () => ({ title: 'x'.repeat(201), questions: [] })],
    ['missing questions', () => ({ title: 'Changed' })],
    ['non-array questions', () => ({ title: 'Changed', questions: {} })],
    ['null questions', () => ({ title: 'Changed', questions: null })],
    [
      'too many questions',
      () => ({
        title: 'Changed',
        questions: Array.from({ length: 21 }, () => question()),
      }),
    ],
    ['array body', () => []],
    ['array of bodies', () => [{ title: 'Changed', questions: [] }]],
    [
      'ownership injection',
      () => ({ title: 'Changed', questions: [], ownerId: randomUUID() }),
    ],
    [
      'derived field injection',
      () => ({ title: 'Changed', questions: [], hostable: true }),
    ],
    ...(
      [
        ['null question', () => null],
        ['nested array question', () => [question()]],
        ['invalid question UUID', () => ({ ...question(), id: 'bad' })],
        [
          'unsupported question type',
          () => ({ ...question(), type: 'true-false' }),
        ],
        [
          'missing prompt',
          () => {
            const q: Partial<ReturnType<typeof question>> = question();
            delete q.prompt;
            return q;
          },
        ],
        ['long prompt', () => ({ ...question(), prompt: 'x'.repeat(2001) })],
        ['null options', () => ({ ...question(), options: null })],
        [
          'too many options',
          () => ({
            ...question(),
            options: Array.from({ length: 5 }, () => ({
              id: randomUUID(),
              text: 'x',
            })),
          }),
        ],
        ['null option', () => ({ ...question(), options: [null] })],
        [
          'nested array option',
          () => ({ ...question(), options: [[question().options[0]]] }),
        ],
        [
          'invalid option UUID',
          () => ({ ...question(), options: [{ id: 'bad', text: 'x' }] }),
        ],
        [
          'long option text',
          () => ({
            ...question(),
            options: [{ id: randomUUID(), text: 'x'.repeat(1001) }],
          }),
        ],
        [
          'unknown option property',
          () => ({
            ...question(),
            options: [{ id: randomUUID(), text: 'x', isCorrect: true }],
          }),
        ],
        [
          'non-array correct mappings',
          () => ({ ...question(), correctOptionIds: 'bad' }),
        ],
        [
          'missing correct mappings',
          () => {
            const q: Partial<ReturnType<typeof question>> = question();
            delete q.correctOptionIds;
            return q;
          },
        ],
        [
          'invalid correct UUID',
          () => ({ ...question(), correctOptionIds: ['bad'] }),
        ],
        [
          'missing duration',
          () => {
            const q: Partial<ReturnType<typeof question>> = question();
            delete q.durationSeconds;
            return q;
          },
        ],
        ['string duration', () => ({ ...question(), durationSeconds: '20' })],
        [
          'fractional duration',
          () => ({ ...question(), durationSeconds: 10.5 }),
        ],
        ['negative duration', () => ({ ...question(), durationSeconds: -1 })],
        [
          'unbounded duration',
          () => ({ ...question(), durationSeconds: 3601 }),
        ],
        [
          'unknown question property',
          () => ({ ...question(), ownerId: randomUUID() }),
        ],
      ] as [string, () => unknown][]
    ).map(
      ([name, build]) =>
        [name, () => ({ title: 'Changed', questions: [build()] })] as [
          string,
          () => unknown,
        ],
    ),
  ];

  it.each(invalidSaves)(
    'rejects malformed save: %s and preserves the saved aggregate',
    async (_name, build) => {
      const draft = await createDraft();
      const saved = await request(server)
        .put(`/quizzes/${draft.id}`)
        .auth(token, { type: 'bearer' })
        .send({ title: 'Original', questions: [question()] })
        .expect(200);
      await request(server)
        .put(`/quizzes/${draft.id}`)
        .auth(token, { type: 'bearer' })
        .send(build() as object)
        .expect(400);
      const read = await request(server)
        .get(`/quizzes/${draft.id}`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(read.body).toEqual(saved.body);
    },
  );

  it('allows a full replacement to remove questions and save an empty draft', async () => {
    const draft = await createDraft();
    await request(server)
      .put(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .send({ title: 'Ready', questions: [question()] })
      .expect(200);
    const saved = await request(server)
      .put(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .send({ title: '', questions: [] })
      .expect(200);
    expect(saved.body).toMatchObject({
      title: '',
      questions: [],
      hostable: false,
    });
    const read = await request(server)
      .get(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(read.body).toEqual(saved.body);
  });

  it.each(['hostable', 'incomplete', 'empty'])(
    'publishes a %s save example matching save and read',
    async (name) => {
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().addBearerAuth().build(),
      );
      const operation = document.paths['/quizzes/{id}'].put!;
      expect(operation.security).toEqual([{ bearer: [] }]);
      const requestBody = operation.requestBody!;
      if (!('content' in requestBody))
        throw new Error('Missing documented body');
      const input = requestBody.content['application/json'].examples![name];
      if (!('value' in input)) throw new Error('Missing request example');
      const exampleInput = input.value as Record<string, unknown>;
      const response = operation.responses['200'];
      if (!('content' in response)) throw new Error('Missing response content');
      const example = response.content!['application/json'].examples![name];
      if (!('value' in example)) throw new Error('Missing response example');
      const draft = await createDraft();
      const saved = await request(server)
        .put(`/quizzes/${draft.id}`)
        .auth(token, { type: 'bearer' })
        .send(exampleInput)
        .expect(200);
      const body = saved.body as {
        id: string;
        createdAt: string;
        updatedAt: string;
      };
      expect(saved.body).toEqual({
        ...example.value,
        id: body.id,
        createdAt: body.createdAt,
        updatedAt: body.updatedAt,
      });
      const read = await request(server)
        .get(`/quizzes/${draft.id}`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(read.body).toEqual(saved.body);
      expect(document.components?.schemas?.QuizDetailDto).toMatchObject({
        properties: {
          questions: {
            type: 'array',
            maxItems: 20,
            items: { $ref: '#/components/schemas/QuizQuestionDto' },
          },
        },
      });
      expect(document.components?.schemas?.SaveQuizDto).toMatchObject({
        required: ['title', 'questions'],
      });
      const invalid = await request(server)
        .put(`/quizzes/${draft.id}`)
        .auth(token, { type: 'bearer' })
        .send({ ...exampleInput, ownerId: 'forged' })
        .expect(400);
      expect(invalid.body).toEqual(documentedExample(operation, '400'));
      const denied = await request(server)
        .put(`/quizzes/${draft.id}`)
        .send(exampleInput)
        .expect(401);
      expect(denied.body).toEqual(documentedExample(operation, '401'));
      const missing = await request(server)
        .put('/quizzes/00000000-0000-4000-8000-000000000000')
        .auth(token, { type: 'bearer' })
        .send(exampleInput)
        .expect(404);
      expect(missing.body).toEqual(documentedExample(operation, '404'));
    },
  );

  it('saves twenty hostable questions at the structural boundary', async () => {
    const draft = await createDraft();
    const input = {
      title: 'Twenty',
      questions: Array.from({ length: 20 }, () => question()),
    };
    const saved = await request(server)
      .put(`/quizzes/${draft.id}`)
      .auth(token, { type: 'bearer' })
      .send(input)
      .expect(200);
    expect(saved.body).toMatchObject({ ...input, hostable: true, errors: [] });
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

  it('reopens a committed edited quiz from an independent application instance', async () => {
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
      const saved = await request(server)
        .put(`/quizzes/${(created.body as { id: string }).id}`)
        .auth(durableToken, { type: 'bearer' })
        .send({
          title: 'Durable edited quiz',
          questions: [question('Committed question')],
        })
        .expect(200);
      second = await createTestApp({ validation: true });
      const read = await request(second.app.getHttpServer() as Server)
        .get(`/quizzes/${(created.body as { id: string }).id}`)
        .auth(durableToken, { type: 'bearer' })
        .expect(200);
      expect(read.body).toEqual(saved.body);
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
