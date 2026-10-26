import type {
  AnswerReceipt,
  QuestionState,
} from '../../../domain/live-question';
export const LIVE_QUESTION_PORT = Symbol('LIVE_QUESTION_PORT');
export interface StartQuestionInput {
  roomId: string;
  ownerId: string;
  connectionId: string;
  commandId: string;
  expectedRevision: number;
}
export interface SubmitAnswerInput {
  roomId: string;
  connectionId: string;
  questionId: string;
  submissionId: string;
  optionId: string;
}
export interface LiveQuestionPort {
  submit(input: SubmitAnswerInput): AnswerReceipt;
  start(input: StartQuestionInput): QuestionState;
  snapshot(roomId: string, connectionId?: string): QuestionState | null;
}
