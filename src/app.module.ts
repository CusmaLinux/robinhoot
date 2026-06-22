import { Module } from '@nestjs/common';
import { AuthModule } from './auth/infrastructure/auth.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
