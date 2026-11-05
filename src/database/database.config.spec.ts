import { databaseConfig } from './database.config';

describe('deployment database configuration', () => {
  it('connects to a PostgreSQL URL with verified TLS and decoded credentials', () => {
    expect(
      databaseConfig({
        DATABASE_URL:
          'postgresql://owner:p%40ss@db.example.com:5432/pilot?sslmode=require',
      }),
    ).toMatchObject({
      host: 'db.example.com',
      database: 'pilot',
      user: 'owner',
      password: 'p@ss',
      port: 5432,
      ssl: { rejectUnauthorized: true },
    });
  });

  it('cannot disable certificate verification through URL parameters', () => {
    expect(
      databaseConfig({
        DATABASE_URL:
          'postgres://owner:secret@db.example.com/pilot?sslmode=no-verify',
      }).ssl,
    ).toEqual({ rejectUnauthorized: true });
  });

  it('retains local database configuration without requiring TLS', () => {
    expect(
      databaseConfig({ DB_PASSWORD: 'local', DB_NAME: 'robinhoot_cd_test' }),
    ).toMatchObject({ database: 'robinhoot_cd_test', password: 'local' });
    expect(databaseConfig({ DB_PASSWORD: 'local' }).ssl).toBeUndefined();
  });

  it('does not include a malformed secret URL in validation errors', () => {
    expect(() => databaseConfig({ DATABASE_URL: 'secret-value' })).toThrow(
      'DATABASE_URL must be a valid PostgreSQL connection URL',
    );
  });
});
