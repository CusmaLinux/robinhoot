import { InMemoryRoomStore } from '../../infrastructure/adapters/out/in-memory-room.store';
import { LobbyService } from './lobby.service';
import { RandomGuestCredentialIssuer } from '../../infrastructure/adapters/out/random-guest-credential.issuer';

describe('Lobby admission', () => {
  let rooms: InMemoryRoomStore;
  let lobby: LobbyService;
  let pin: string;
  let roomId: string;
  const join = (overrides = {}) =>
    lobby.join({
      pin,
      nickname: 'Alice',
      requestId: '58df38ab-e6de-4444-bbe0-d119c648a60b',
      connectionId: 'socket-1',
      ...overrides,
    });
  beforeEach(async () => {
    rooms = new InMemoryRoomStore();
    const room = await rooms.create(
      { ownerId: 'owner', quizId: 'quiz', requestId: 'create' },
      () =>
        Promise.resolve({
          version: 1,
          sourceQuizId: 'quiz',
          title: 'Quiz',
          questions: [],
        }),
    );
    pin = room.pin;
    roomId = room.roomId;
    lobby = new LobbyService(rooms, new RandomGuestCredentialIssuer());
  });
  it('admits a guest with a private room-scoped session and safe roster', async () => {
    const rooms = new InMemoryRoomStore();
    const room = await rooms.create(
      { ownerId: 'owner', quizId: 'quiz', requestId: 'create' },
      () =>
        Promise.resolve({
          version: 1,
          sourceQuizId: 'quiz',
          title: 'Quiz',
          questions: [],
        }),
    );
    const lobby = new LobbyService(rooms, new RandomGuestCredentialIssuer());
    const result = lobby.join({
      pin: room.pin,
      nickname: '  Alice  ',
      requestId: '58df38ab-e6de-4444-bbe0-d119c648a60b',
      connectionId: 'socket-1',
    });
    expect(result).toMatchObject({
      roomId: room.roomId,
      playerId: expect.any(String) as string,
      credential: expect.any(String) as string,
      state: {
        roomId: room.roomId,
        revision: 1,
        phase: 'lobby',
        roster: [
          {
            playerId: expect.any(String) as string,
            nickname: 'Alice',
            connected: true,
          },
        ],
      },
    });
    expect(JSON.stringify(result.state)).not.toContain(result.credential);
  });
  it('revokes the original join receipt when a live session is replaced', () => {
    const first = join();
    lobby.restore({
      roomId,
      credential: first.credential,
      connectionId: 'replacement',
    });
    expect(() => join()).toThrow(
      'Join request is bound to its original connection and nickname',
    );
    expect(lobby.disconnect(roomId, 'socket-1')).toBeNull();
  });
  it('allows only the current guest connection to read a subscribed snapshot', () => {
    const first = join();
    lobby.restore({
      roomId,
      credential: first.credential,
      connectionId: 'replacement',
    });
    expect(() => lobby.syncGuest(roomId, 'socket-1')).toThrow(
      'Connection no longer owns this guest session',
    );
    expect(lobby.syncGuest(roomId, 'replacement')).toMatchObject({
      revision: 2,
      roster: [{ playerId: first.playerId }],
    });
  });
  it('replays restoration on the current connection without another revision', () => {
    const first = join();
    const input = {
      roomId,
      credential: first.credential,
      connectionId: 'replacement',
    };
    const restored = lobby.restore(input);
    expect(lobby.restore(input).state).toEqual(restored.state);
  });
  it('rejects a foreign room credential without changing either roster', async () => {
    const first = join();
    const other = await rooms.create(
      { ownerId: 'other', quizId: 'quiz', requestId: 'create' },
      () =>
        Promise.resolve({
          version: 1,
          sourceQuizId: 'quiz',
          title: 'Quiz',
          questions: [],
        }),
    );
    expect(() =>
      lobby.restore({
        roomId: other.roomId,
        credential: first.credential,
        connectionId: 'attacker',
      }),
    ).toThrow('Invalid room credential');
    expect(lobby.syncGuest(roomId, 'socket-1')).toEqual(first.state);
    expect(lobby.bindHost(other.roomId, 'other')).toMatchObject({
      revision: 0,
      roster: [],
    });
  });
  it('rejects restoration into a closed room', () => {
    const first = join();
    rooms.mutate(roomId, (room) => ({ ...room, phase: 'closed' }));
    expect(() =>
      lobby.restore({
        roomId,
        credential: first.credential,
        connectionId: 'new',
      }),
    ).toThrow('Room is closed');
  });
  it('rejects an unknown room with the same credential failure', () => {
    const first = join();
    expect(() =>
      lobby.restore({
        roomId: 'unknown',
        credential: first.credential,
        connectionId: 'new',
      }),
    ).toThrow('Invalid room credential');
  });
  it('does not switch a bound connection to another guest identity', () => {
    const first = join();
    const bob = join({
      nickname: 'Bob',
      requestId: 'bob',
      connectionId: 'bob',
    });
    expect(() =>
      lobby.restore({
        roomId,
        credential: first.credential,
        connectionId: 'bob',
        boundRoomId: roomId,
        boundPlayerId: bob.playerId,
      }),
    ).toThrow('Connection is already bound to a lobby actor');
    expect(lobby.syncGuest(roomId, 'bob').revision).toBe(2);
  });
  it('restores a reserved slot even at thirty-player capacity', () => {
    const first = join();
    for (let i = 1; i < 30; i++)
      join({
        nickname: `Player ${i}`,
        requestId: `request-${i}`,
        connectionId: `socket-${i + 1}`,
      });
    const restored = lobby.restore({
      roomId,
      credential: first.credential,
      connectionId: 'replacement',
    });
    expect(restored.state.roster).toHaveLength(30);
    expect(restored.playerId).toBe(first.playerId);
  });
  it('replays the admitting connection request without consuming a slot', () => {
    const first = join();
    expect(join()).toEqual(first);
    expect(rooms.findById(roomId)?.guests).toHaveLength(1);
  });
  it('rejects duplicate trimmed nicknames ignoring case without mutation', () => {
    join();
    expect(() =>
      join({
        nickname: ' alice ',
        requestId: 'other',
        connectionId: 'socket-2',
      }),
    ).toThrow('Nickname is already in use');
    expect(rooms.findById(roomId)?.revision).toBe(1);
  });
  it.each(['', '   ', 'a'.repeat(21)])(
    'rejects invalid nickname %p without mutation',
    (nickname) => {
      expect(() => join({ nickname })).toThrow(
        'Nickname must contain 1–20 characters',
      );
      expect(rooms.findById(roomId)?.revision).toBe(0);
    },
  );
  it('limits admission to thirty players while accepting a retry at capacity', () => {
    for (let i = 0; i < 30; i++)
      join({
        nickname: `Player ${i}`,
        requestId: `request-${i}`,
        connectionId: `socket-${i}`,
      });
    expect(() =>
      join({ nickname: 'Extra', requestId: 'extra', connectionId: 'extra' }),
    ).toThrow('Lobby has thirty players');
    expect(
      join({
        nickname: 'Player 0',
        requestId: 'request-0',
        connectionId: 'socket-0',
      }).state.roster,
    ).toHaveLength(30);
  });
  it('rejects admission to a closed room', () => {
    rooms.mutate(roomId, (room) => ({ ...room, phase: 'closed' }));
    expect(() => join()).toThrow('Room is closed');
    expect(rooms.findById(roomId)?.revision).toBe(0);
  });
  it('does not give one connection a second player identity', () => {
    join();
    expect(() => join({ nickname: 'Bob', requestId: 'other' })).toThrow(
      'Connection already has a guest identity',
    );
    expect(rooms.findById(roomId)?.guests).toHaveLength(1);
  });
});

describe('Lobby restoration', () => {
  it('restores an offline guest with its credential without adding a roster slot', async () => {
    const rooms = new InMemoryRoomStore();
    const room = await rooms.create(
      { ownerId: 'owner', quizId: 'quiz', requestId: 'create' },
      () =>
        Promise.resolve({
          version: 1,
          sourceQuizId: 'quiz',
          title: 'Quiz',
          questions: [],
        }),
    );
    const lobby = new LobbyService(rooms, new RandomGuestCredentialIssuer());
    const first = lobby.join({
      pin: room.pin,
      nickname: 'Alice',
      requestId: 'join',
      connectionId: 'old',
    });
    lobby.disconnect(room.roomId, 'old');
    const restored = lobby.restore({
      roomId: room.roomId,
      credential: first.credential,
      connectionId: 'new',
    });
    expect(restored).toMatchObject({
      playerId: first.playerId,
      credential: first.credential,
      state: {
        revision: 3,
        roster: [
          { playerId: first.playerId, nickname: 'Alice', connected: true },
        ],
      },
    });
    expect(restored.state.roster).toHaveLength(1);
  });
});
