import { Logger, Provider } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from './database.types';
import { databaseConfig } from './database.config';

export const KYSELY_TOKEN = 'KYSELY_INSTANCE';

export const databaseProvider: Provider = {
  provide: KYSELY_TOKEN,
  useFactory: () => {
    const pool = new Pool(databaseConfig());
    pool.on('error', () => {
      Logger.error('Idle PostgreSQL connection failed', 'Database');
    });
    const dialect = new PostgresDialect({
      pool,
    });

    return new Kysely<Database>({
      dialect,
    });
  },
};
