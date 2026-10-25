import type { LobbyState } from '../../../domain/lobby';
export const LOBBY_USE_CASE_PORT = Symbol('LOBBY_USE_CASE_PORT');
export interface JoinLobbyInput {
  pin: string;
  nickname: string;
  requestId: string;
  connectionId: string;
  boundRoomId?: string;
}
export interface Admission {
  roomId: string;
  playerId: string;
  credential: string;
  state: LobbyState;
}
export interface LobbyUseCasePort {
  disconnect(roomId: string, connectionId: string): LobbyState | null;
  bindHost(roomId: string, ownerId: string): LobbyState;
  join(input: JoinLobbyInput): Admission;
}
