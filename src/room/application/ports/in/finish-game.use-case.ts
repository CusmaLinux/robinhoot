import type { StartQuestionInput } from './live-question.use-case';
import type { GameReport } from '../../../domain/game-report';
export const FINISH_GAME_PORT = Symbol('FINISH_GAME_PORT');
export interface FinishedGame {
  roomId: string;
  revision: number;
  phase: 'finished';
  report: GameReport;
}
export interface FinishGamePort {
  finish(input: StartQuestionInput): Promise<FinishedGame>;
}
