import type { LobbyClosure } from '../../../domain/lobby';
export const LOBBY_EVENTS_PORT = Symbol('LOBBY_EVENTS_PORT');
export interface LobbyEventsPort {
  closed(closure: LobbyClosure): void;
}
