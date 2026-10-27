import type { QuestionState } from './live-question';
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

export interface LobbyState extends Partial<
  Omit<QuestionState, 'phase' | 'roomId' | 'revision'>
> {
  roomId: string;
  revision: number;
  phase: 'lobby' | 'closed' | 'question_open' | 'question_reveal' | 'finished';
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
