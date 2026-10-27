import { Inject, Injectable } from '@nestjs/common';
import { QUIZ_AUTHORING_USE_CASE_PORT } from '../../../../quiz/application/ports/in/quiz-authoring.use-case';
import type { QuizAuthoringUseCasePort } from '../../../../quiz/application/ports/in/quiz-authoring.use-case';
import type { QuizSnapshotReaderPort } from '../../../application/ports/out/quiz-snapshot-reader.port';
import type { QuizSnapshot } from '../../../domain/room';
import {
  QuizNotFoundError,
  QuizNotHostableError,
} from '../../../domain/room.errors';

@Injectable()
export class OwnedQuizSnapshotReader implements QuizSnapshotReaderPort {
  constructor(
    @Inject(QUIZ_AUTHORING_USE_CASE_PORT)
    private readonly quizzes: QuizAuthoringUseCasePort,
  ) {}

  async readOwned(ownerId: string, quizId: string): Promise<QuizSnapshot> {
    const quiz = await this.quizzes.read(ownerId, quizId);
    if (!quiz) throw new QuizNotFoundError('Quiz not found');
    if (!quiz.hostable) throw new QuizNotHostableError(quiz.errors);
    return {
      version: quiz.questions.some(
        (question) =>
          question.type === 'true-false' ||
          question.imageUrl !== undefined ||
          question.imageDescription !== undefined,
      )
        ? 2
        : 1,
      sourceQuizId: quiz.id,
      title: quiz.title,
      questions: quiz.questions.map((question) => ({
        ...question,
        durationSeconds: question.durationSeconds!,
      })),
    };
  }
}
