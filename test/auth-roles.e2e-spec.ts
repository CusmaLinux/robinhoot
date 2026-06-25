import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Server } from 'net';
import request from 'supertest';
import { Kysely } from 'kysely';
import { Database } from '../src/database/database.types';
import {
  createTestApp,
  beginTransaction,
  rollbackTransaction,
  destroyTestApp,
} from './helpers/setup-test-app';
import { TestPool } from './helpers/test-pool';

describe('RBAC (e2e)', () => {
  let app: INestApplication;
  let pool: TestPool;
  let db: Kysely<Database>;
  let httpServer: Server;

  const testEmail = 'rbac-test@example.com';
  const testPassword = 'TestPassword123!';

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    pool = setup.pool;
    db = setup.db;
    httpServer = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await beginTransaction(pool);
  });

  afterEach(async () => {
    await rollbackTransaction(pool);
  });

  afterAll(async () => {
    await destroyTestApp(app, db);
  });

  describe('Auth with roles', () => {
    it('should register with default user role', async () => {
      const response = await request(httpServer)
        .post('/auth/register')
        .send({ email: testEmail, password: testPassword })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', testEmail);
    });

    it('should login and return access token', async () => {
      await request(httpServer)
        .post('/auth/register')
        .send({ email: testEmail, password: testPassword })
        .expect(201);

      const loginResponse = await request(httpServer)
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200);

      const body = loginResponse.body as { accessToken: string };
      expect(body).toHaveProperty('accessToken');
    });

    it('should access authenticated endpoint with token', async () => {
      await request(httpServer)
        .post('/auth/register')
        .send({ email: testEmail, password: testPassword })
        .expect(201);

      const loginResponse = await request(httpServer)
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200);

      const { accessToken } = loginResponse.body as { accessToken: string };

      const response = await request(httpServer)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should reject request without token', async () => {
      await request(httpServer).post('/auth/logout').expect(401);
    });
  });
});
