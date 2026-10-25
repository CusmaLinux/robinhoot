import { INestApplication } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Server } from 'http';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import type { Database } from '../src/database/database.types';
import type { LobbyState } from '../src/room/domain/lobby';
import type { Admission } from '../src/room/application/ports/in/lobby.use-case';
import {
  createTestApp,
  beginTransaction,
  rollbackTransaction,
  destroyTestApp,
} from './helpers/setup-test-app';
import { TestPool } from './helpers/test-pool';

type Ack<T = Admission> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

describe('Lobby Socket.IO transport', () => {
  let app: INestApplication;
  let db: Kysely<Database>;
  let pool: TestPool;
  let server: Server;
  let url: string;
  let token: string;
  let room: { roomId: string; pin: string };
  const clients: Socket[] = [];
  async function connect(auth = {}): Promise<Socket> {
    const client = io(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth,
    });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });
    return client;
  }
  function ack<T = Admission>(
    client: Socket,
    event: string,
    payload: unknown,
  ): Promise<Ack<T>> {
    return client.timeout(2000).emitWithAck(event, payload) as Promise<Ack<T>>;
  }
  function join(
    client: Socket,
    nickname: string,
    requestId = randomUUID(),
    pin = room.pin,
  ) {
    return ack(client, 'lobby.join', { pin, nickname, requestId });
  }
  function admission(result: Ack): Admission {
    if (!result.ok) throw new Error(result.error.code);
    return result.data;
  }
  function nextState(client: Socket): Promise<LobbyState> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        client.off('lobby.roster', done);
        reject(new Error('Missing roster'));
      }, 2000);
      function done(value: LobbyState) {
        clearTimeout(timer);
        resolve(value);
      }
      client.once('lobby.roster', done);
    });
  }
  async function loginAccount(): Promise<string> {
    const credentials = {
      email: `lobby-${randomUUID()}@example.com`,
      password: 'TestPassword123!',
    };
    await request(server).post('/auth/register').send(credentials).expect(201);
    const login = await request(server)
      .post('/auth/login')
      .send(credentials)
      .expect(200);
    return (login.body as { accessToken: string }).accessToken;
  }
  async function createRoom(token: string) {
    const draft = await request(server)
      .post('/quizzes')
      .auth(token, { type: 'bearer' })
      .send({})
      .expect(201);
    const quizId = (draft.body as { id: string }).id;
    const options = ['A', 'B', 'C', 'D'].map((text) => ({
      id: randomUUID(),
      text,
    }));
    await request(server)
      .put(`/quizzes/${quizId}`)
      .auth(token, { type: 'bearer' })
      .send({
        title: 'Private answer key',
        questions: [
          {
            id: randomUUID(),
            type: 'multiple-choice',
            prompt: 'Secret question?',
            options,
            correctOptionIds: [options[0].id],
            durationSeconds: 20,
          },
        ],
      })
      .expect(200);
    const created = await request(server)
      .post('/rooms')
      .auth(token, { type: 'bearer' })
      .send({ quizId, requestId: randomUUID() })
      .expect(201);
    return created.body as typeof room;
  }
  beforeEach(async () => {
    if (!process.env.DB_NAME?.endsWith('_test'))
      throw new Error('Dedicated test database required');
    ({ app, db, pool } = await createTestApp({ validation: true }));
    await app.listen(0, '127.0.0.1');
    server = app.getHttpServer() as Server;
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('No TCP address');
    url = `http://127.0.0.1:${address.port}`;
    await beginTransaction(pool);
    const accountToken = await loginAccount();
    token = accountToken;
    room = await createRoom(token);
  });
  afterEach(async () => {
    clients.splice(0).forEach((client) => client.disconnect());
    await rollbackTransaction(pool);
    if (app) await destroyTestApp(app, db);
  });

  it('admits an unauthenticated guest with a private acknowledgement', async () => {
    const guest = await connect();
    expect(await join(guest, '  Alice  ')).toMatchObject({
      ok: true,
      data: {
        roomId: room.roomId,
        credential: expect.any(String) as string,
        state: { roster: [{ nickname: 'Alice', connected: true }] },
      },
    });
  });
  it('binds an authenticated owner and broadcasts consistent state to host and two guests', async () => {
    const host = await connect({ token });
    expect(
      await ack<LobbyState>(host, 'host.bind', { roomId: room.roomId }),
    ).toMatchObject({ ok: true, data: { roomId: room.roomId, roster: [] } });
    const alice = await connect();
    const hostFirst = nextState(host);
    await join(alice, 'Alice');
    await hostFirst;
    const bob = await connect();
    const hostState = nextState(host);
    const aliceState = nextState(alice);
    const admitted = await join(bob, 'Bob');
    if (!admitted.ok) throw new Error(admitted.error.code);
    expect(await hostState).toEqual(admitted.data.state);
    expect(await aliceState).toEqual(admitted.data.state);
    expect(admitted.data.state.roster.map((player) => player.nickname)).toEqual(
      ['Alice', 'Bob'],
    );
  });
  it('throttles admission attempts before resolving PINs without roster mutation', async () => {
    const guest = await connect();
    for (let i = 0; i < 10; i++)
      await join(guest, 'Alice', randomUUID(), 'not-a-pin');
    expect(await join(guest, 'Alice')).toMatchObject({
      ok: false,
      error: { code: 'ADMISSION_THROTTLED' },
    });
    const host = await connect({ token });
    expect(
      await ack<LobbyState>(host, 'host.bind', { roomId: room.roomId }),
    ).toMatchObject({ ok: true, data: { revision: 0, roster: [] } });
  });
  it.each([
    null,
    [],
    {},
    { pin: '123456', nickname: 'Alice', requestId: 'not-uuid' },
    {
      pin: '123456',
      nickname: 'Alice',
      requestId: randomUUID(),
      playerId: 'victim',
    },
  ])('rejects malformed join payload %p explicitly', async (payload) => {
    const guest = await connect();
    expect(await ack(guest, 'lobby.join', payload)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PAYLOAD' },
    });
  });
  it('marks a disconnected guest offline while retaining its slot', async () => {
    const host = await connect({ token });
    await ack(host, 'host.bind', { roomId: room.roomId });
    const guest = await connect();
    await join(guest, 'Alice');
    const offline = nextState(host);
    guest.disconnect();
    expect(await offline).toMatchObject({
      revision: 2,
      roster: [{ nickname: 'Alice', connected: false }],
    });
  });
  it('keeps one connection bound to one lobby', async () => {
    const accountToken = await loginAccount();
    const other = await createRoom(accountToken);
    const guest = await connect();
    await join(guest, 'Alice');
    expect(await join(guest, 'Bob', randomUUID(), other.pin)).toMatchObject({
      ok: false,
      error: { code: 'SESSION_ALREADY_BOUND' },
    });
  });

  it.each([{}, { token: 'invalid-token' }])(
    'rejects host messages without a valid account %p',
    async (auth) => {
      const host = await connect(auth);
      expect(
        await ack(host, 'host.bind', { roomId: room.roomId }),
      ).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
    },
  );

  it('rejects a foreign account host binding without exposing the roster', async () => {
    const accountToken = await loginAccount();
    const host = await connect({
      token: accountToken,
    });
    expect(await ack(host, 'host.bind', { roomId: room.roomId })).toEqual({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Room is not owned by this account',
      },
    });
  });

  it('revalidates host tokens after logout', async () => {
    const host = await connect({ token });
    await ack(host, 'host.bind', { roomId: room.roomId });
    await request(server)
      .post('/auth/logout')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(await ack(host, 'host.bind', { roomId: room.roomId })).toMatchObject(
      { ok: false, error: { code: 'UNAUTHORIZED' } },
    );
  });

  it('keeps private HTTP controllers protected after gateway installation', async () => {
    await request(server).get('/quizzes').expect(401);
    await request(server)
      .post('/rooms')
      .send({ quizId: randomUUID(), requestId: randomUUID() })
      .expect(401);
    await request(server)
      .get('/quizzes')
      .auth(token, { type: 'bearer' })
      .expect(200);
  });

  it('replays simultaneous join retries with one identity and one slot', async () => {
    const guest = await connect();
    const requestId = randomUUID();
    const [first, retry] = await Promise.all([
      join(guest, 'Alice', requestId),
      join(guest, 'Alice', requestId),
    ]);
    expect(first.ok).toBe(true);
    expect(retry).toEqual(first);
    if (!first.ok) throw new Error(first.error.code);
    expect(first.data.state).toMatchObject({
      revision: 1,
      roster: [{ nickname: 'Alice' }],
    });
  });

  it('rejects a copied request ID on another connection without revealing credentials', async () => {
    const guest = await connect();
    const requestId = randomUUID();
    const first = await join(guest, 'Alice', requestId);
    const attacker = await connect();
    const copied = await join(attacker, 'Alice', requestId);
    expect(copied).toMatchObject({
      ok: false,
      error: { code: 'JOIN_REQUEST_CONFLICT' },
    });
    if (!first.ok) throw new Error(first.error.code);
    expect(JSON.stringify(copied)).not.toContain(first.data.credential);
  });

  it('rejects case-insensitive duplicate nicknames without broadcasting a roster mutation', async () => {
    const host = await connect({ token });
    await ack(host, 'host.bind', { roomId: room.roomId });
    const alice = await connect();
    await join(alice, 'Alice');
    const messages: LobbyState[] = [];
    host.on('lobby.roster', (value) => messages.push(value as LobbyState));
    const attacker = await connect();
    expect(await join(attacker, ' alice ')).toMatchObject({
      ok: false,
      error: { code: 'NICKNAME_TAKEN' },
    });
    expect(
      await ack<LobbyState>(host, 'host.bind', { roomId: room.roomId }),
    ).toMatchObject({
      ok: true,
      data: { revision: 1, roster: [{ nickname: 'Alice' }] },
    });
    expect(messages).toEqual([]);
  });

  it('returns INVALID_PIN for an unknown six-digit PIN', async () => {
    const guest = await connect();
    const unknown = room.pin === '000000' ? '000001' : '000000';
    expect(await join(guest, 'Alice', randomUUID(), unknown)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PIN' },
    });
  });

  it.each(['', '   ', 'a'.repeat(21)])(
    'rejects invalid nickname %p over the real transport',
    async (nickname) => {
      const guest = await connect();
      expect(await join(guest, nickname)).toMatchObject({
        ok: false,
        error: { code: 'INVALID_NICKNAME' },
      });
    },
  );

  it('enforces thirty players with real independent clients and permits a retry at capacity', async () => {
    const first = await connect();
    const requestId = randomUUID();
    await join(first, 'Player 0', requestId);
    for (let i = 1; i < 30; i++) await join(await connect(), `Player ${i}`);
    expect(await join(await connect(), 'Extra')).toMatchObject({
      ok: false,
      error: { code: 'ROOM_FULL' },
    });
    const retry = await join(first, 'Player 0', requestId);
    if (!retry.ok) throw new Error(retry.error.code);
    expect(retry.data.state.roster).toHaveLength(30);
    expect(retry.data.state.revision).toBe(30);
  });

  it('broadcasts only safe display identity and connection state', async () => {
    const host = await connect({ token });
    await ack(host, 'host.bind', { roomId: room.roomId });
    const alice = await connect();
    const first = admission(await join(alice, 'Alice'));
    const hostState = nextState(host);
    const bob = await connect();
    const second = admission(await join(bob, 'Bob'));
    const broadcast = await hostState;
    expect(Object.keys(broadcast).sort()).toEqual([
      'phase',
      'revision',
      'roomId',
      'roster',
    ]);
    for (const player of broadcast.roster)
      expect(Object.keys(player).sort()).toEqual([
        'connected',
        'nickname',
        'playerId',
      ]);
    const publicJson = JSON.stringify(broadcast);
    for (const secret of [
      first.credential,
      second.credential,
      token,
      'correctOptionIds',
      'Private answer key',
      'Secret question?',
      'credentialVerifier',
      'connectionId',
    ])
      expect(publicJson).not.toContain(secret);
    expect(JSON.stringify(second)).not.toContain(first.credential);
  });

  it('isolates roster broadcasts between two owned rooms', async () => {
    const accountToken = await loginAccount();
    const otherToken = accountToken;
    const other = await createRoom(otherToken);
    const host = await connect({ token });
    await ack(host, 'host.bind', { roomId: room.roomId });
    const otherHost = await connect({ token: otherToken });
    await ack(otherHost, 'host.bind', { roomId: other.roomId });
    const foreignMessages: LobbyState[] = [];
    host.on('lobby.roster', (value) =>
      foreignMessages.push(value as LobbyState),
    );
    const otherState = nextState(otherHost);
    await join(await connect(), 'Alice', randomUUID(), other.pin);
    expect(await otherState).toMatchObject({
      roomId: other.roomId,
      roster: [{ nickname: 'Alice' }],
    });
    await ack(host, 'host.bind', { roomId: room.roomId });
    expect(foreignMessages).toEqual([]);
  });
});
