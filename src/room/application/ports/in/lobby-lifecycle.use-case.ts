import type { Room } from '../../../domain/room';
import type { LobbyClosure } from '../../../domain/lobby';
export const LOBBY_LIFECYCLE_PORT = Symbol('LOBBY_LIFECYCLE_PORT');
export interface LobbyLifecyclePort {
  beginFinalization(roomId: string): void;
  failFinalization(roomId: string): void;
  completeFinalization(roomId: string): void;
  track(room: Room): void;
  startPlaying(roomId: string, cancelQuestion: () => void): void;
  assertOpen(roomId: string): void;
  bind(roomId: string, ownerId: string, connectionId: string): string | null;
  assertHost(roomId: string, ownerId: string, connectionId: string): void;
  disconnect(roomId: string, connectionId: string): void;
  cancel(roomId: string, ownerId: string, connectionId?: string): LobbyClosure;
}
