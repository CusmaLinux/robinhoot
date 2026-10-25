import type { QuizSnapshot } from '../../../domain/room';

export const QUIZ_SNAPSHOT_READER_PORT = Symbol('QUIZ_SNAPSHOT_READER_PORT');

export interface QuizSnapshotReaderPort {
  readOwned(ownerId: string, quizId: string): Promise<QuizSnapshot>;
}
