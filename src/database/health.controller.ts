import {
  Controller,
  Get,
  Header,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql, Kysely } from 'kysely';
import { Public } from '../auth/infrastructure/adapters/in/public.decorator';
import { KYSELY_TOKEN } from './database.provider';
import type { Database } from './database.types';

@Controller('health')
export class HealthController {
  constructor(@Inject(KYSELY_TOKEN) private readonly db: Kysely<Database>) {}

  @Public()
  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async ready() {
    try {
      await sql`select 1`.execute(this.db);
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable' });
    }
    return {
      status: 'ok',
      revision: process.env.RELEASE_SHA || 'development',
    };
  }
}
