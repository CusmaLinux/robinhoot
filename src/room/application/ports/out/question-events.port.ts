import type { QuestionState } from '../../../domain/live-question';
export const QUESTION_EVENTS_PORT = Symbol('QUESTION_EVENTS_PORT');
export interface QuestionEventsPort {
  opened(state: QuestionState): void;
  revealed(state: QuestionState): void;
}
