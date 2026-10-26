import type { Room } from '../../../domain/room';
import type { LobbyClosure } from '../../../domain/lobby';
export const LOBBY_LIFECYCLE_PORT = Symbol('LOBBY_LIFECYCLE_PORT');
export interface LobbyLifecyclePort {
  track(room: Room): void;
  assertOpen(roomId: string): void;
  bind(roomId: string, ownerId: string, connectionId: string): string | null;
  assertHost(roomId: string, ownerId: string, connectionId: string): void;
  disconnect(roomId: string, connectionId: string): void;
  cancel(roomId: string, ownerId: string, connectionId?: string): LobbyClosure;
}
