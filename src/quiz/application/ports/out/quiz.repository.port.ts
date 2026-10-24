import type { Quiz } from '../../../domain/quiz';

export const QUIZ_REPOSITORY_PORT = Symbol('QUIZ_REPOSITORY_PORT');

export interface QuizRepositoryPort {
  create(ownerId: string, title: string): Promise<Quiz>;
  findOwned(ownerId: string, id: string): Promise<Quiz | null>;
  listOwned(ownerId: string): Promise<Quiz[]>;
}
