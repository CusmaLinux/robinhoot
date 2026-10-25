import type { Quiz, QuizContent } from '../../../domain/quiz';

export const QUIZ_REPOSITORY_PORT = Symbol('QUIZ_REPOSITORY_PORT');

export interface QuizRepositoryPort {
  deleteOwned(ownerId: string, id: string): Promise<boolean>;
  saveOwned(
    ownerId: string,
    id: string,
    content: QuizContent,
  ): Promise<Quiz | null>;
  create(ownerId: string, title: string): Promise<Quiz>;
  findOwned(ownerId: string, id: string): Promise<Quiz | null>;
  listOwned(ownerId: string): Promise<Quiz[]>;
}
