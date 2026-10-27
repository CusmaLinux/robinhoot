import type { FinishedGame } from '../in/finish-game.use-case';
export const GAME_EVENTS_PORT = Symbol('GAME_EVENTS_PORT');
export interface GameEventsPort {
  finished(state: FinishedGame): void;
}
