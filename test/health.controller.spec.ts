import type { INestApplication } from '@nestjs/common';
import type { Kysely } from 'kysely';
import request from 'supertest';
import type { Server } from 'node:http';
import type { Database } from '../src/database/database.types';
import { createTestApp, destroyTestApp } from './helpers/setup-test-app';

describe('deployment readiness', () => {
  let app: INestApplication<Server>;
  let db: Kysely<Database>;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
  });
  afterAll(async () => destroyTestApp(app, db));

  it('allows an unauthenticated operator to verify database readiness', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', revision: 'development' });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('reports database failure without returning connection details', async () => {
    const unavailable = await createTestApp();
    await request((unavailable.app as INestApplication<Server>).getHttpServer())
      .get('/health/ready')
      .expect(200);
    await unavailable.db.destroy();
    try {
      const response = await request(
        (unavailable.app as INestApplication<Server>).getHttpServer(),
      ).get('/health/ready');
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ status: 'unavailable' });
    } finally {
      await unavailable.app.close();
    }
  });
});
