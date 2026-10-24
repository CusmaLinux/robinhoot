import { Inject, Injectable } from '@nestjs/common';
import { QUIZ_REPOSITORY_PORT } from '../ports/out/quiz.repository.port';
import type { QuizRepositoryPort } from '../ports/out/quiz.repository.port';
import type {
  QuizAuthoringUseCasePort,
  QuizDetail,
  QuizSummary,
} from '../ports/in/quiz-authoring.use-case';
import { assertQuizStructure, quizReadiness } from '../../domain/quiz';
import type { QuizContent } from '../../domain/quiz';

@Injectable()
export class QuizAuthoringService implements QuizAuthoringUseCasePort {
  constructor(
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly repository: QuizRepositoryPort,
  ) {}

  async save(
    ownerId: string,
    id: string,
    content: QuizContent,
  ): Promise<QuizDetail | null> {
    assertQuizStructure(content);
    const quiz = await this.repository.saveOwned(ownerId, id, content);
    return quiz ? { ...quiz, ...quizReadiness(quiz) } : null;
  }

  async create(ownerId: string, title: string): Promise<QuizDetail> {
    const quiz = await this.repository.create(ownerId, title);
    return { ...quiz, ...quizReadiness(quiz) };
  }

  async read(ownerId: string, id: string): Promise<QuizDetail | null> {
    const quiz = await this.repository.findOwned(ownerId, id);
    return quiz ? { ...quiz, ...quizReadiness(quiz) } : null;
  }

  async list(ownerId: string): Promise<QuizSummary[]> {
    const quizzes = await this.repository.listOwned(ownerId);
    return quizzes.map(({ questions, ...quiz }) => ({
      ...quiz,
      questionCount: questions.length,
      hostable: quizReadiness({ ...quiz, questions }).hostable,
    }));
  }
}
