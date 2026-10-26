import type { QuestionState } from '../../../domain/live-question';
export const LIVE_QUESTION_PORT = Symbol('LIVE_QUESTION_PORT');
export interface StartQuestionInput {
  roomId: string;
  ownerId: string;
  connectionId: string;
  commandId: string;
  expectedRevision: number;
}
export interface LiveQuestionPort {
  start(input: StartQuestionInput): QuestionState;
  snapshot(roomId: string): QuestionState | null;
}
