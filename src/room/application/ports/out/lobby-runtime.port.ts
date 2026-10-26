export const LOBBY_RUNTIME_PORT = Symbol('LOBBY_RUNTIME_PORT');
export interface LobbyRuntimePort {
  now(): number;
  schedule(at: number, callback: () => void): () => void;
}
