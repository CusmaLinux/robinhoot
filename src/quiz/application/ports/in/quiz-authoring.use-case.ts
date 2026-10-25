import type { Quiz, QuizContent, ReadinessError } from '../../../domain/quiz';

export const QUIZ_AUTHORING_USE_CASE_PORT = Symbol(
  'QUIZ_AUTHORING_USE_CASE_PORT',
);

export type QuizDetail = Quiz & { hostable: boolean; errors: ReadinessError[] };
export type QuizSummary = Omit<Quiz, 'questions'> & {
  questionCount: number;
  hostable: boolean;
};

export interface QuizAuthoringUseCasePort {
  delete(ownerId: string, id: string): Promise<boolean>;
  save(
    ownerId: string,
    id: string,
    content: QuizContent,
  ): Promise<QuizDetail | null>;
  create(ownerId: string, title: string): Promise<QuizDetail>;
  read(ownerId: string, id: string): Promise<QuizDetail | null>;
  list(ownerId: string): Promise<QuizSummary[]>;
}
