import { Provider } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from './database.types';

export const KYSELY_TOKEN = 'KYSELY_INSTANCE';

export const databaseProvider: Provider = {
  provide: KYSELY_TOKEN,
  useFactory: () => {
    const dialect = new PostgresDialect({
      pool: new Pool({
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'robinhoot',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        max: 10,
      }),
    });

    return new Kysely<Database>({
      dialect,
    });
  },
};
