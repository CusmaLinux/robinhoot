import { Module } from '@nestjs/common';
import { QuizController } from './adapters/in/quiz.controller';
import { QuizKyselyAdapter } from './adapters/out/quiz.kysely.adapter';
import { QuizAuthoringService } from '../application/services/quiz-authoring.service';
import { QUIZ_REPOSITORY_PORT } from '../application/ports/out/quiz.repository.port';
import { QUIZ_AUTHORING_USE_CASE_PORT } from '../application/ports/in/quiz-authoring.use-case';

@Module({
  controllers: [QuizController],
  providers: [
    QuizAuthoringService,
    {
      provide: QUIZ_AUTHORING_USE_CASE_PORT,
      useExisting: QuizAuthoringService,
    },
    { provide: QUIZ_REPOSITORY_PORT, useClass: QuizKyselyAdapter },
  ],
})
export class QuizModule {}
