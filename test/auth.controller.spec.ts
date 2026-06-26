import 'dotenv/config';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Server } from 'net';
import { Kysely } from 'kysely';
import { Database } from '../src/database/database.types';
import {
  createTestApp,
  beginTransaction,
  rollbackTransaction,
  destroyTestApp,
} from './helpers/setup-test-app';
import { TestPool } from './helpers/test-pool';

interface SetupResult {
  app: INestApplication;
  pool: TestPool;
  db: Kysely<Database>;
}

describe('AuthController (integration)', () => {
  let app: INestApplication;
  let pool: TestPool;
  let db: Kysely<Database>;
  let httpServer: Server;

  const testEmail = `controller-test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  beforeAll(async () => {
    const setup: SetupResult = await createTestApp();
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

  describe('POST /auth/register', () => {
    it('should return 201 with id and email on success', async () => {
      const response = await request(httpServer)
        .post('/auth/register')
        .send({ email: testEmail, password: testPassword })
        .expect(201);

      const body = response.body as { id: string; email: string };
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('email', testEmail);
    });

    it('should return 409 Conflict when email already exists', async () => {
      await request(httpServer)
        .post('/auth/register')
        .send({ email: testEmail, password: testPassword })
        .expect(201);

      await request(httpServer)
        .post('/auth/register')
        .send({ email: testEmail, password: testPassword })
        .expect(409);
    });
  });

  describe('POST /auth/login', () => {
    it('should return 200 with access token for valid credentials', async () => {
      await request(httpServer)
        .post('/auth/register')
        .send({ email: testEmail, password: testPassword })
        .expect(201);

      const response = await request(httpServer)
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200);

      const body = response.body as { accessToken: string };
      expect(body).toHaveProperty('accessToken');
      expect(typeof body.accessToken).toBe('string');
    });

    it('should return 401 Unauthorized for invalid password', async () => {
      await request(httpServer)
        .post('/auth/register')
        .send({ email: testEmail, password: testPassword })
        .expect(201);

      await request(httpServer)
        .post('/auth/login')
        .send({ email: testEmail, password: 'wrongpassword' })
        .expect(401);
    });

    it('should return 401 Unauthorized for non-existent email', async () => {
      await request(httpServer)
        .post('/auth/login')
        .send({ email: 'nonexistent@example.com', password: testPassword })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should return 200 with success true for authenticated request', async () => {
      await request(httpServer)
        .post('/auth/register')
        .send({ email: testEmail, password: testPassword })
        .expect(201);

      const loginResponse = await request(httpServer)
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200);

      const loginBody = loginResponse.body as { accessToken: string };
      const accessToken = loginBody.accessToken;

      const response = await request(httpServer)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as { success: boolean };
      expect(body).toHaveProperty('success', true);
    });

    it('should return 401 Unauthorized when no token provided', async () => {
      await request(httpServer).post('/auth/logout').expect(401);
    });
  });
});
