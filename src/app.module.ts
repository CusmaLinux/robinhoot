import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/infrastructure/auth.module';
import { DatabaseModule } from './database/database.module';
import { QuizModule } from './quiz/infrastructure/quiz.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    DatabaseModule,
    AuthModule,
    QuizModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
