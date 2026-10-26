import type { LobbyRuntimePort } from '../../../application/ports/out/lobby-runtime.port';

export class SystemLobbyRuntime implements LobbyRuntimePort {
  now(): number {
    return Date.now();
  }
  schedule(at: number, callback: () => void): () => void {
    const timer = setTimeout(callback, Math.max(0, at - this.now()));
    timer.unref();
    return () => clearTimeout(timer);
  }
}
