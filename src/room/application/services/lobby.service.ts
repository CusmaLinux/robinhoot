import { Inject, Injectable } from '@nestjs/common';
import { ROOM_STORE_PORT } from '../ports/out/room-store.port';
import type { RoomStorePort } from '../ports/out/room-store.port';
import { GUEST_CREDENTIAL_ISSUER_PORT } from '../ports/out/guest-credential-issuer.port';
import type { GuestCredentialIssuerPort } from '../ports/out/guest-credential-issuer.port';
import type {
  JoinLobbyInput,
  LobbyUseCasePort,
} from '../ports/in/lobby.use-case';
import { LobbyError, type LobbyState } from '../../domain/lobby';
import type { Room } from '../../domain/room';

function state(room: Room): LobbyState {
  return {
    roomId: room.roomId,
    revision: room.revision,
    phase: room.phase,
    roster: room.guests.map((guest) => ({
      playerId: guest.playerId,
      nickname: guest.nickname,
      connected: guest.connectionId !== null,
    })),
  };
}

function normalizeNickname(nickname: string): string {
  if (
    typeof nickname !== 'string' ||
    nickname.trim().length < 1 ||
    Array.from(nickname.trim()).length > 20
  )
    throw new LobbyError(
      'INVALID_NICKNAME',
      'Nickname must contain 1–20 characters',
    );
  return nickname.trim();
}

@Injectable()
export class LobbyService implements LobbyUseCasePort {
  constructor(
    @Inject(ROOM_STORE_PORT) private readonly rooms: RoomStorePort,
    @Inject(GUEST_CREDENTIAL_ISSUER_PORT)
    private readonly credentials: GuestCredentialIssuerPort,
  ) {}

  disconnect(roomId: string, connectionId: string): LobbyState | null {
    const room = this.rooms.findById(roomId);
    if (
      !room ||
      !room.guests.some((guest) => guest.connectionId === connectionId)
    )
      return null;
    return state(
      this.rooms.mutate(roomId, (current) => ({
        ...current,
        revision: current.revision + 1,
        guests: Object.freeze(
          current.guests.map((guest) =>
            guest.connectionId === connectionId
              ? Object.freeze({
                  ...guest,
                  connectionId: null,
                  admission: Object.freeze({
                    ...guest.admission,
                    credential: '',
                  }),
                })
              : guest,
          ),
        ),
      })),
    );
  }

  bindHost(roomId: string, ownerId: string): LobbyState {
    const room = this.rooms.findById(roomId);
    if (!room || room.host.ownerId !== ownerId)
      throw new LobbyError('FORBIDDEN', 'Room is not owned by this account');
    if (room.phase !== 'lobby')
      throw new LobbyError('ROOM_CLOSED', 'Room is closed');
    return state(room);
  }

  join(input: JoinLobbyInput) {
    const nickname = normalizeNickname(input.nickname);
    const room = this.rooms.findByPin(input.pin);
    if (!room) throw new LobbyError('INVALID_PIN', 'No lobby has this PIN');
    if (room.phase !== 'lobby')
      throw new LobbyError('ROOM_CLOSED', 'Room is closed');
    if (input.boundRoomId && input.boundRoomId !== room.roomId)
      throw new LobbyError(
        'SESSION_ALREADY_BOUND',
        'Connection is already bound to a lobby actor',
      );
    const receipt = room.guests.find(
      (guest) => guest.admission.requestId === input.requestId,
    );
    if (receipt) {
      if (
        receipt.admission.connectionId !== input.connectionId ||
        receipt.nickname !== nickname
      )
        throw new LobbyError(
          'JOIN_REQUEST_CONFLICT',
          'Join request is bound to its original connection and nickname',
        );
      return {
        roomId: room.roomId,
        playerId: receipt.playerId,
        credential: receipt.admission.credential,
        state: state(room),
      };
    }
    return this.admit(room, input, nickname);
  }

  private admit(room: Room, input: JoinLobbyInput, nickname: string) {
    if (
      room.guests.some(
        (guest) => guest.nickname.toLowerCase() === nickname.toLowerCase(),
      )
    )
      throw new LobbyError('NICKNAME_TAKEN', 'Nickname is already in use');
    if (room.guests.length >= 30)
      throw new LobbyError('ROOM_FULL', 'Lobby has thirty players');
    if (room.guests.some((guest) => guest.connectionId === input.connectionId))
      throw new LobbyError(
        'SESSION_ALREADY_BOUND',
        'Connection already has a guest identity',
      );
    const session = this.credentials.issue();
    const guest = Object.freeze({
      playerId: session.playerId,
      nickname: nickname,
      connectionId: input.connectionId,
      credentialVerifier: session.verifier,
      admission: Object.freeze({
        requestId: input.requestId,
        connectionId: input.connectionId,
        credential: session.credential,
      }),
    });
    const next = this.rooms.mutate(room.roomId, (current) => ({
      ...current,
      revision: current.revision + 1,
      guests: Object.freeze([...current.guests, guest]),
    }));
    return {
      roomId: room.roomId,
      playerId: session.playerId,
      credential: session.credential,
      state: state(next),
    };
  }
}
