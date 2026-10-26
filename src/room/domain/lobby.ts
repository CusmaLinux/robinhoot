export interface Guest {
  readonly playerId: string;
  readonly nickname: string;
  readonly connectionId: string | null;
  readonly credentialVerifier: string;
  readonly admission: {
    readonly requestId: string;
    readonly connectionId: string;
    readonly credential: string;
  };
}

export interface LobbyState {
  roomId: string;
  revision: number;
  phase: 'lobby' | 'closed';
  roster: { playerId: string; nickname: string; connected: boolean }[];
}

export class LobbyError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type LobbyClosureReason =
  'OWNER_CANCELLED' | 'LOBBY_EXPIRED' | 'HOST_TIMEOUT';
export interface LobbyClosure {
  roomId: string;
  revision: number;
  phase: 'closed';
  reason: LobbyClosureReason;
}
