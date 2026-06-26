import 'dotenv/config';
import { Kysely } from 'kysely';
import { Database } from '../src/database/database.types';
import {
  createTestApp,
  beginTransaction,
  rollbackTransaction,
} from './helpers/setup-test-app';
import { TestPool } from './helpers/test-pool';
import { UserKyselyAdapter } from '../src/auth/infrastructure/adapters/out/user.kysely.adapter';

describe('UserKyselyAdapter (integration)', () => {
  let adapter: UserKyselyAdapter;
  let pool: TestPool;
  let db: Kysely<Database>;

  const testEmail = `kysely-adapter-test-${Date.now()}@example.com`;
  const testPassword = 'hashed-password';

  beforeAll(async () => {
    const setup = await createTestApp();
    db = setup.db;
    pool = setup.pool;
    adapter = new UserKyselyAdapter(db);
  });

  beforeEach(async () => {
    await beginTransaction(pool);
  });

  afterEach(async () => {
    await rollbackTransaction(pool);
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('findByEmail', () => {
    it('should return null when user does not exist', async () => {
      const result = await adapter.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should return user entity when user exists', async () => {
      await adapter.create(testEmail, testPassword);

      const result = await adapter.findByEmail(testEmail);

      expect(result).not.toBeNull();
      expect(result!.email).toBe(testEmail);
      expect(result!.passwordHash).toBe(testPassword);
      expect(result!.roles).toContain('user');
    });
  });

  describe('findById', () => {
    it('should return null when user does not exist', async () => {
      const result = await adapter.findById(
        '00000000-0000-0000-0000-000000000000',
      );

      expect(result).toBeNull();
    });

    it('should return user entity when user exists', async () => {
      const created = await adapter.create(testEmail, testPassword);

      const result = await adapter.findById(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.id);
    });
  });

  describe('create', () => {
    it('should create user and return entity with default user role', async () => {
      const result = await adapter.create(testEmail, testPassword);

      expect(result.email).toBe(testEmail);
      expect(result.passwordHash).toBe(testPassword);
      expect(result.roles).toEqual(['user']);
      expect(result.tokenVersion).toBe(1);
    });
  });

  describe('bumpTokenVersion', () => {
    it('should increment token version', async () => {
      const created = await adapter.create(testEmail, testPassword);

      expect(created.tokenVersion).toBe(1);

      await adapter.bumpTokenVersion(created.id);

      const user = await adapter.findById(created.id);
      expect(user!.tokenVersion).toBe(2);
    });
  });
});
