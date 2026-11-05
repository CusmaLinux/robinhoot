import { Global, Module } from '@nestjs/common';
import { databaseProvider } from './database.provider';
import { HealthController } from './health.controller';

@Global()
@Module({
  controllers: [HealthController],
  providers: [databaseProvider],
  exports: [databaseProvider],
})
export class DatabaseModule {}
