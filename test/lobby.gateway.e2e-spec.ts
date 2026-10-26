import type { LobbyRuntimePort } from '../src/room/application/ports/out/lobby-runtime.port';

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
import { LobbyGateway } from '../src/room/infrastructure/adapters/in/lobby.gateway';
import type { QuestionState } from '../src/room/domain/live-question';

// Advances only room time; real TCP, authentication and Socket.IO keep running.
class ManualLobbyRuntime implements LobbyRuntimePort {
  private time = Date.now();
  private readonly pending = new Map<() => void, number>();
  now(): number {
    return this.time;
  }
  wallNow(): number {
    return this.time;
  }
  schedule(at: number, callback: () => void): () => void {
    this.pending.set(callback, at);
    return () => {
      this.pending.delete(callback);
    };
  }
  advance(milliseconds: number): void {
    this.time += milliseconds;
    for (const [callback, at] of this.pending) {
      if (at <= this.time) {
        this.pending.delete(callback);
        callback();
      }
    }
  }
}

type Ack<T = Admission> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

describe('Lobby Socket.IO transport', () => {
  let app: INestApplication;
  let runtime: ManualLobbyRuntime;
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
  async function connectHost() {
    const host = await connect({ token });
    expect(await ack(host, 'host.bind', { roomId: room.roomId })).toMatchObject(
      { ok: true },
    );
    return host;
  }
  async function disconnectHost(host: Socket): Promise<void> {
    const disconnected = new Promise<void>((resolve) =>
      app
        .get(LobbyGateway)
        ['server'].sockets.sockets.get(host.id!)!
        .once('disconnect', () => resolve()),
    );
    host.disconnect();
    await disconnected;
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
  async function mutateDuringSubscription<T>(
    client: Socket,
    event: string,
    payload: unknown,
    mutate: () => Promise<unknown>,
  ): Promise<Ack<T>> {
    const adapter = app.get(LobbyGateway)['server'].of('/').adapter;
    const addAll = adapter.addAll.bind(adapter) as typeof adapter.addAll;
    let entered!: () => void;
    let release!: () => void;
    const subscribed = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = jest
      .spyOn(adapter, 'addAll')
      .mockImplementation((id, channels) => {
        if (id === client.id && channels.has(`lobby:${room.roomId}`)) {
          entered();
          return gate.then(() => addAll(id, channels));
        }
        return addAll(id, channels);
      });
    const response = ack<T>(client, event, payload);
    try {
      await subscribed;
      await mutate();
      release();
      return await response;
    } finally {
      release();
      spy.mockRestore();
    }
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
    runtime = new ManualLobbyRuntime();
    ({ app, db, pool } = await createTestApp({
      validation: true,
      lobbyRuntime: runtime,
      questionRuntime: runtime,
    }));
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

  it('opens a safe timed question for a host and two independent guests', async () => {
    const host = await connectHost();
    const a = await connect();
    const b = await connect();
    await join(a, 'Alice');
    await join(b, 'Bob');
    const received = new Promise<QuestionState>((resolve) =>
      b.once('question.opened', resolve),
    );
    const response = await ack<QuestionState>(host, 'host.start', {
      roomId: room.roomId,
      commandId: randomUUID(),
      expectedRevision: 2,
    });
    expect(response).toMatchObject({
      ok: true,
      data: { phase: 'question_open', revision: 3 },
    });
    const state = await received;
    expect(state.question.options.map((option) => option.label)).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
    expect(state.deadline - state.openedAt).toBe(20_000);
    expect(state.eligiblePlayerIds).toHaveLength(2);
    expect(state).not.toHaveProperty('correctOptionIds');
    expect(JSON.stringify(state)).not.toMatch(
      /credential|correctOption|ownerId|monotonic/,
    );
  });

  it('automatically reveals a no-answer round once to host and guests at server time', async () => {
    const host = await connectHost();
    const a = await connect();
    const b = await connect();
    await join(a, 'Alice');
    await join(b, 'Bob');
    await ack(host, 'host.start', {
      roomId: room.roomId,
      commandId: randomUUID(),
      expectedRevision: 2,
    });
    const reveals: QuestionState[] = [];
    a.on('question.revealed', (value: QuestionState) => reveals.push(value));
    const revealed = new Promise<QuestionState>((resolve) =>
      b.once('question.revealed', resolve),
    );
    runtime.advance(19_999);
    expect(reveals).toHaveLength(0);
    runtime.advance(1);
    const state = await revealed;
    expect(state).toMatchObject({
      phase: 'question_reveal',
      revision: 4,
      score: 0,
    });
    expect(state.correctOptionIds).toEqual([state.question.options[0].id]);
    expect(
      await ack(host, 'state.sync', { roomId: room.roomId }),
    ).toMatchObject({
      ok: true,
      data: { phase: 'question_reveal', revision: 4 },
    });
    runtime.advance(20_000);
    await ack(a, 'state.sync', { roomId: room.roomId });
    expect(reveals).toHaveLength(1);
  });

  it('keeps one deadline when an opening acknowledgement is lost and retried after reveal', async () => {
    const host = await connectHost();
    const guest = await connect();
    await join(guest, 'Alice');
    const input = {
      roomId: room.roomId,
      commandId: randomUUID(),
      expectedRevision: 1,
    };
    const opens: QuestionState[] = [];
    guest.on('question.opened', (state: QuestionState) => opens.push(state));
    const first = await ack<QuestionState>(host, 'host.start', input);
    if (!first.ok) throw new Error(first.error.code);
    runtime.advance(10_000);
    expect(await ack(host, 'host.start', input)).toMatchObject({
      ok: true,
      data: { revision: 2, deadline: first.data.deadline },
    });
    runtime.advance(10_000);
    expect(await ack(host, 'host.start', input)).toMatchObject({
      ok: true,
      data: {
        phase: 'question_reveal',
        revision: 3,
        deadline: first.data.deadline,
        score: 0,
      },
    });
    expect(opens).toHaveLength(1);
  });

  it('rejects new admissions once the round opens', async () => {
    const host = await connectHost();
    await join(await connect(), 'Alice');
    await ack(host, 'host.start', {
      roomId: room.roomId,
      commandId: randomUUID(),
      expectedRevision: 1,
    });
    expect(await join(await connect(), 'Bob')).toMatchObject({
      ok: false,
      error: { code: 'ROOM_CLOSED' },
    });
    expect(
      await ack(host, 'state.sync', { roomId: room.roomId }),
    ).toMatchObject({
      ok: true,
      data: {
        roster: [{ nickname: 'Alice' }],
        eligiblePlayerIds: expect.any(Array) as string[],
        revision: 2,
      },
    });
  });

  it('rejects an owner start while the lobby is empty', async () => {
    const host = await connectHost();
    expect(
      await ack(host, 'host.start', {
        roomId: room.roomId,
        commandId: randomUUID(),
        expectedRevision: 0,
      }),
    ).toMatchObject({ ok: false, error: { code: 'EMPTY_LOBBY' } });
    expect(
      await ack(host, 'state.sync', { roomId: room.roomId }),
    ).toMatchObject({ ok: true, data: { phase: 'lobby', revision: 0 } });
  });

  it('denies a guest start without a host account token', async () => {
    const guest = await connect();
    await join(guest, 'Alice');
    expect(
      await ack(guest, 'host.start', {
        roomId: room.roomId,
        commandId: randomUUID(),
        expectedRevision: 1,
      }),
    ).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
  });

  it('denies a foreign account start even with a valid account token', async () => {
    await join(await connect(), 'Alice');
    const other = await connect({ token: await loginAccount() });
    expect(
      await ack(other, 'host.start', {
        roomId: room.roomId,
        commandId: randomUUID(),
        expectedRevision: 1,
      }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('revalidates the host token before accepting start', async () => {
    const host = await connectHost();
    await join(await connect(), 'Alice');
    await request(server)
      .post('/auth/logout')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(
      await ack(host, 'host.start', {
        roomId: room.roomId,
        commandId: randomUUID(),
        expectedRevision: 1,
      }),
    ).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
  });

  it('rejects a superseded host start without consuming its command', async () => {
    const old = await connectHost();
    await join(await connect(), 'Alice');
    const current = await connectHost();
    const input = {
      roomId: room.roomId,
      commandId: randomUUID(),
      expectedRevision: 1,
    };
    expect(await ack(old, 'host.start', input)).toMatchObject({
      ok: false,
      error: { code: 'SESSION_REPLACED' },
    });
    expect(await ack(current, 'host.start', input)).toMatchObject({
      ok: true,
      data: { phase: 'question_open', revision: 2 },
    });
  });

  it('rejects stale revision and conflicting command content without another opening', async () => {
    const host = await connectHost();
    await join(await connect(), 'Alice');
    const input = {
      roomId: room.roomId,
      commandId: randomUUID(),
      expectedRevision: 1,
    };
    expect(
      await ack(host, 'host.start', { ...input, expectedRevision: 0 }),
    ).toMatchObject({ ok: false, error: { code: 'STALE_REVISION' } });
    await ack(host, 'host.start', input);
    expect(
      await ack(host, 'host.start', { ...input, expectedRevision: 2 }),
    ).toMatchObject({ ok: false, error: { code: 'COMMAND_CONFLICT' } });
    expect(
      await ack(host, 'host.start', {
        ...input,
        commandId: randomUUID(),
        expectedRevision: 2,
      }),
    ).toMatchObject({ ok: false, error: { code: 'WRONG_PHASE' } });
  });

  it.each([undefined, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1])(
    'rejects malformed start revision %p',
    async (expectedRevision) => {
      const host = await connectHost();
      expect(
        await ack(host, 'host.start', {
          roomId: room.roomId,
          commandId: randomUUID(),
          expectedRevision,
        }),
      ).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } });
    },
  );

  it('rejects injected host identity in a start payload', async () => {
    const host = await connectHost();
    expect(
      await ack(host, 'host.start', {
        roomId: room.roomId,
        commandId: randomUUID(),
        expectedRevision: 0,
        ownerId: randomUUID(),
      }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } });
  });

  it('isolates question events from clients in a different room', async () => {
    const host = await connectHost();
    await join(await connect(), 'Alice');
    const otherRoom = await createRoom(await loginAccount());
    const otherGuest = await connect();
    await join(otherGuest, 'Bob', randomUUID(), otherRoom.pin);
    const events: QuestionState[] = [];
    otherGuest.on('question.opened', (state: QuestionState) =>
      events.push(state),
    );
    otherGuest.on('question.revealed', (state: QuestionState) =>
      events.push(state),
    );
    await ack(host, 'host.start', {
      roomId: room.roomId,
      commandId: randomUUID(),
      expectedRevision: 1,
    });
    runtime.advance(20_000);
    await ack(otherGuest, 'state.sync', { roomId: otherRoom.roomId });
    expect(events).toHaveLength(0);
  });

  it('returns the current safe question when start occurs during guest subscription', async () => {
    const host = await connectHost();
    const guest = await connect();
    const result = await mutateDuringSubscription<Admission>(
      guest,
      'lobby.join',
      { pin: room.pin, nickname: 'Alice', requestId: randomUUID() },
      async () => {
        expect(
          await ack(host, 'host.start', {
            roomId: room.roomId,
            commandId: randomUUID(),
            expectedRevision: 1,
          }),
        ).toMatchObject({ ok: true });
      },
    );
    expect(result).toMatchObject({
      ok: true,
      data: {
        state: {
          phase: 'question_open',
          revision: 2,
          question: {
            options: expect.any(Array) as QuestionState['question']['options'],
          },
        },
      },
    });
    if (!result.ok) throw new Error(result.error.code);
    expect(result.data.state).not.toHaveProperty('correctOptionIds');
  });

  it('retains the roster on host return within 120 seconds', async () => {
    const host = await connectHost();
    const a = await connect();
    const b = await connect();
    const first = admission(await join(a, 'Alice'));
    await join(b, 'Bob');
    await disconnectHost(host);
    runtime.advance(119_999);
    const returned = await connectHost();
    const synced = await ack<LobbyState>(returned, 'state.sync', {
      roomId: room.roomId,
    });
    expect(synced).toMatchObject({
      ok: true,
      data: {
        roster: [
          { playerId: first.playerId, nickname: 'Alice' },
          { nickname: 'Bob' },
        ],
      },
    });
    runtime.advance(1);
    expect(
      await ack(returned, 'state.sync', { roomId: room.roomId }),
    ).toMatchObject({ ok: true });
  });

  it('broadcasts host timeout to waiting guests and isolates other rooms', async () => {
    const host = await connectHost();
    const a = await connect();
    const b = await connect();
    await join(a, 'Alice');
    await join(b, 'Bob');
    const foreignToken = await loginAccount();
    const other = await createRoom(foreignToken);
    const foreign = await connect({ token: foreignToken });
    await ack(foreign, 'host.bind', { roomId: other.roomId });
    const leaked = jest.fn();
    foreign.on('lobby.closed', leaked);
    const closed = [a, b].map(
      (client) =>
        new Promise((resolve) => client.once('lobby.closed', resolve)),
    );
    await disconnectHost(host);
    runtime.advance(120_000);
    expect(await Promise.all(closed)).toEqual([
      expect.objectContaining({ reason: 'HOST_TIMEOUT' }),
      expect.objectContaining({ reason: 'HOST_TIMEOUT' }),
    ]);
    expect(
      await ack(foreign, 'state.sync', { roomId: other.roomId }),
    ).toMatchObject({ ok: true });
    expect(leaked).not.toHaveBeenCalled();
    const returning = await connect({ token });
    expect(
      await ack(returning, 'host.bind', { roomId: room.roomId }),
    ).toMatchObject({
      ok: false,
      error: { code: 'ROOM_CLOSED', message: 'HOST_TIMEOUT' },
    });
  });

  it('publishes expiry once and removes channel subscriptions', async () => {
    const host = await connectHost();
    const guest = await connect();
    await join(guest, 'Alice');
    const observed: unknown[] = [];
    guest.on('lobby.closed', (value) => observed.push(value));
    const closed = new Promise((resolve) =>
      guest.once('lobby.closed', resolve),
    );
    runtime.advance(30 * 60_000);
    expect(await closed).toMatchObject({
      roomId: room.roomId,
      reason: 'LOBBY_EXPIRED',
      revision: 2,
    });
    runtime.advance(30 * 60_000);
    expect(observed).toHaveLength(1);
    expect(
      app
        .get(LobbyGateway)
        ['server'].sockets.adapter.rooms.has(`lobby:${room.roomId}`),
    ).toBe(false);
    expect(host.connected).toBe(true);
  });

  it('rejects cancellation by guests and foreign authenticated accounts', async () => {
    const host = await connectHost();
    const guest = await connect();
    await join(guest, 'Alice');
    const payload = { roomId: room.roomId, commandId: randomUUID() };
    expect(await ack(guest, 'host.cancel', payload)).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });
    const foreign = await connect({ token: await loginAccount() });
    expect(await ack(foreign, 'host.cancel', payload)).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(
      await ack(foreign, 'host.bind', { roomId: room.roomId }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(
      await ack(host, 'state.sync', { roomId: room.roomId }),
    ).toMatchObject({ ok: true });
  });

  it('revokes cancellation and sync authority from a replaced host', async () => {
    const old = await connectHost();
    const current = await connectHost();
    expect(
      await ack(old, 'host.cancel', {
        roomId: room.roomId,
        commandId: randomUUID(),
      }),
    ).toMatchObject({ ok: false, error: { code: 'SESSION_REPLACED' } });
    expect(await ack(old, 'state.sync', { roomId: room.roomId })).toMatchObject(
      { ok: false, error: { code: 'SESSION_REPLACED' } },
    );
    old.disconnect();
    runtime.advance(120_000);
    expect(
      await ack(current, 'state.sync', { roomId: room.roomId }),
    ).toMatchObject({ ok: true });
  });

  it('revalidates the owner token on cancellation and return after logout', async () => {
    const host = await connectHost();
    await request(server)
      .post('/auth/logout')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(
      await ack(host, 'host.cancel', {
        roomId: room.roomId,
        commandId: randomUUID(),
      }),
    ).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
    const returning = await connect({ token });
    expect(
      await ack(returning, 'host.bind', { roomId: room.roomId }),
    ).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
  });

  it('rejects an obsolete host while its subscription is still pending', async () => {
    const pending = await connect({ token });
    let current!: Socket;
    const result = await mutateDuringSubscription(
      pending,
      'host.bind',
      { roomId: room.roomId },
      async () => {
        current = await connectHost();
      },
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'SESSION_REPLACED' },
    });
    expect(
      app
        .get(LobbyGateway)
        ['server'].sockets.adapter.rooms.get(`lobby:${room.roomId}`)
        ?.has(pending.id!),
    ).toBe(false);
    expect(
      await ack(current, 'state.sync', { roomId: room.roomId }),
    ).toMatchObject({ ok: true });
  });

  it('returns the closure outcome when a guest subscription finishes after cancellation', async () => {
    const host = await connectHost();
    const guest = await connect();
    const result = await mutateDuringSubscription(
      guest,
      'lobby.join',
      { pin: room.pin, nickname: 'Alice', requestId: randomUUID() },
      () =>
        ack(host, 'host.cancel', {
          roomId: room.roomId,
          commandId: randomUUID(),
        }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'ROOM_CLOSED', message: 'OWNER_CANCELLED' },
    });
    expect(
      app
        .get(LobbyGateway)
        ['server'].sockets.adapter.rooms.has(`lobby:${room.roomId}`),
    ).toBe(false);
  });

  it.each([
    {},
    { roomId: 'bad', commandId: randomUUID() },
    { commandId: 'bad' },
    { commandId: randomUUID(), ownerId: 'injected' },
  ])('rejects malformed host cancellation payload %j', async (payload) => {
    const host = await connectHost();
    expect(
      await ack(host, 'host.cancel', { roomId: room.roomId, ...payload }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } });
    expect(
      await ack(host, 'state.sync', { roomId: room.roomId }),
    ).toMatchObject({ ok: true });
  });

  it('broadcasts owner cancellation to the host and two guests and rejects later admission', async () => {
    const host = await connectHost();
    const a = await connect();
    const b = await connect();
    const session = admission(await join(a, 'Alice'));
    await join(b, 'Bob');
    const closures = [host, a, b].map(
      (client) =>
        new Promise((resolve) => client.once('lobby.closed', resolve)),
    );
    const payload = { roomId: room.roomId, commandId: randomUUID() };
    const result = await ack(host, 'host.cancel', payload);
    expect(result).toMatchObject({
      ok: true,
      data: { roomId: room.roomId, phase: 'closed', reason: 'OWNER_CANCELLED' },
    });
    expect(await Promise.all(closures)).toEqual([
      expect.objectContaining({ reason: 'OWNER_CANCELLED' }),
      expect.objectContaining({ reason: 'OWNER_CANCELLED' }),
      expect.objectContaining({ reason: 'OWNER_CANCELLED' }),
    ]);
    expect(await ack(host, 'host.cancel', payload)).toEqual(result);
    const fresh = await connect();
    expect(await join(fresh, 'Later')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PIN' },
    });
    expect(
      await ack(fresh, 'session.restore', {
        roomId: room.roomId,
        credential: session.credential,
      }),
    ).toMatchObject({
      ok: false,
      error: { code: 'ROOM_CLOSED', message: 'OWNER_CANCELLED' },
    });
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
  it('restores an offline guest and broadcasts the same identity to host and second guest', async () => {
    const host = await connectHost();
    const alice = await connect();
    const first = admission(await join(alice, 'Alice'));
    const bob = await connect();
    await join(bob, 'Bob');
    const offline = nextState(host);
    alice.disconnect();
    await offline;
    const replacement = await connect();
    const hostState = nextState(host);
    const bobState = nextState(bob);
    const restored = admission(
      await ack(replacement, 'session.restore', {
        roomId: room.roomId,
        credential: first.credential,
      }),
    );
    expect(restored.playerId).toBe(first.playerId);
    expect(restored.credential).toBe(first.credential);
    expect(restored.state.roster).toHaveLength(2);
    expect(restored.state.revision).toBe(4);
    expect(await hostState).toEqual(restored.state);
    expect(await bobState).toEqual(restored.state);
  });
  it('revokes replaced connection sync, join retries, new admissions and disconnect authority', async () => {
    const host = await connectHost();
    const old = await connect();
    const requestId = randomUUID();
    const first = admission(await join(old, 'Alice', requestId));
    const replacement = await connect();
    const restored = admission(
      await ack(replacement, 'session.restore', {
        roomId: room.roomId,
        credential: first.credential,
      }),
    );
    expect(await ack(old, 'state.sync', { roomId: room.roomId })).toMatchObject(
      { ok: false, error: { code: 'SESSION_REPLACED' } },
    );
    expect(await join(old, 'Alice', requestId)).toMatchObject({
      ok: false,
      error: { code: 'JOIN_REQUEST_CONFLICT' },
    });
    expect(await join(old, 'Impostor')).toMatchObject({
      ok: false,
      error: { code: 'SESSION_ALREADY_BOUND' },
    });
    const staleMessages: LobbyState[] = [];
    old.on('lobby.roster', (value: LobbyState) => staleMessages.push(value));
    await join(await connect(), 'Bob');
    expect(staleMessages).toEqual([]);
    old.disconnect();
    expect(
      await ack<LobbyState>(host, 'state.sync', { roomId: room.roomId }),
    ).toMatchObject({
      ok: true,
      data: {
        revision: restored.state.revision + 1,
        roster: [
          { playerId: first.playerId, connected: true },
          { nickname: 'Bob' },
        ],
      },
    });
    expect(
      await ack<LobbyState>(replacement, 'state.sync', { roomId: room.roomId }),
    ).toMatchObject({ ok: true });
  });
  it('captures a roster mutation while restore subscription is pending and receives later mutations', async () => {
    const alice = await connect();
    const first = admission(await join(alice, 'Alice'));
    const replacement = await connect();
    const restored = admission(
      await mutateDuringSubscription<Admission>(
        replacement,
        'session.restore',
        { roomId: room.roomId, credential: first.credential },
        () => joinConnection('Bob'),
      ),
    );
    expect(restored.state).toMatchObject({
      revision: 3,
      roster: [{ nickname: 'Alice' }, { nickname: 'Bob' }],
    });
    const later = nextState(replacement);
    const carol = admission(await joinConnection('Carol'));
    expect(await later).toEqual(carol.state);
  });
  async function joinConnection(nickname: string) {
    return join(await connect(), nickname);
  }
  it('rejects cross-room credentials without subscribing the caller', async () => {
    const first = admission(await join(await connect(), 'Alice'));
    const other = await createRoom(await loginAccount());
    const attacker = await connect();
    expect(
      await ack(attacker, 'session.restore', {
        roomId: other.roomId,
        credential: first.credential,
      }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_CREDENTIAL' } });
    expect(
      await ack(attacker, 'state.sync', { roomId: room.roomId }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(
      await ack(attacker, 'state.sync', { roomId: other.roomId }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });
  it.each(['pin', 'nickname', 'socketId'] as const)(
    'does not accept %s as a restore credential',
    async (identity) => {
      const alice = await connect();
      await join(alice, 'Alice');
      const known = { pin: room.pin, nickname: 'Alice', socketId: alice.id! };
      const attacker = await connect();
      expect(
        await ack(attacker, 'session.restore', {
          roomId: room.roomId,
          credential: known[identity],
        }),
      ).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } });
    },
  );
  it.each([
    null,
    [],
    {},
    { credential: 'x'.repeat(43) },
    { roomId: 'not-uuid', credential: 'x'.repeat(43) },
    { roomId: randomUUID(), credential: 1 },
    {
      roomId: randomUUID(),
      credential: 'x'.repeat(43),
      playerId: randomUUID(),
    },
  ])('rejects malformed restore payload %p', async (payload) => {
    expect(
      await ack(await connect(), 'session.restore', payload),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } });
  });
  it('rejects a guessed valid-format credential without exposing a roster or credential', async () => {
    const first = admission(await join(await connect(), 'Alice'));
    const failed = await ack(await connect(), 'session.restore', {
      roomId: room.roomId,
      credential: 'x'.repeat(43),
    });
    expect(failed).toEqual({
      ok: false,
      error: { code: 'INVALID_CREDENTIAL', message: 'Invalid room credential' },
    });
    expect(JSON.stringify(failed)).not.toContain(first.credential);
  });
  it('keeps successful restore retries on the same revision', async () => {
    const first = admission(await join(await connect(), 'Alice'));
    const replacement = await connect();
    const payload = { roomId: room.roomId, credential: first.credential };
    const firstRestore = await ack(replacement, 'session.restore', payload);
    expect(await ack(replacement, 'session.restore', payload)).toEqual(
      firstRestore,
    );
  });
  it('refuses to switch an existing actor to another guest or room', async () => {
    const alice = await connect();
    const first = admission(await join(alice, 'Alice'));
    const bob = await connect();
    await join(bob, 'Bob');
    expect(
      await ack(bob, 'session.restore', {
        roomId: room.roomId,
        credential: first.credential,
      }),
    ).toMatchObject({ ok: false, error: { code: 'SESSION_ALREADY_BOUND' } });
    const other = await createRoom(await loginAccount());
    const foreign = admission(
      await join(await connect(), 'Foreign', randomUUID(), other.pin),
    );
    expect(
      await ack(alice, 'session.restore', {
        roomId: other.roomId,
        credential: foreign.credential,
      }),
    ).toMatchObject({ ok: false, error: { code: 'SESSION_ALREADY_BOUND' } });
  });
  it('does not turn a bound host into a guest', async () => {
    const first = admission(await join(await connect(), 'Alice'));
    const host = await connectHost();
    expect(
      await ack(host, 'session.restore', {
        roomId: room.roomId,
        credential: first.credential,
      }),
    ).toMatchObject({ ok: false, error: { code: 'SESSION_ALREADY_BOUND' } });
  });
  it('bounds restore attempts using the shared admission budget', async () => {
    const guest = await connect();
    for (let i = 0; i < 10; i++) await ack(guest, 'session.restore', {});
    expect(await join(guest, 'Alice')).toMatchObject({
      ok: false,
      error: { code: 'ADMISSION_THROTTLED' },
    });
  });
  it('captures mutations during state.sync subscription', async () => {
    const alice = await connect();
    await join(alice, 'Alice');
    const synced = await mutateDuringSubscription<LobbyState>(
      alice,
      'state.sync',
      { roomId: room.roomId },
      () => joinConnection('Bob'),
    );
    expect(synced).toMatchObject({
      ok: true,
      data: {
        revision: 2,
        roster: [{ nickname: 'Alice' }, { nickname: 'Bob' }],
      },
    });
  });
  it('captures mutations during host.bind subscription', async () => {
    const host = await connect({ token });
    const bound = await mutateDuringSubscription<LobbyState>(
      host,
      'host.bind',
      { roomId: room.roomId },
      () => joinConnection('Alice'),
    );
    expect(bound).toMatchObject({
      ok: true,
      data: { revision: 1, roster: [{ nickname: 'Alice' }] },
    });
  });
  it('rechecks authority after a pending restore is superseded', async () => {
    const first = admission(await join(await connect(), 'Alice'));
    const pending = await connect();
    const latest = await connect();
    const payload = { roomId: room.roomId, credential: first.credential };
    const result = await mutateDuringSubscription<Admission>(
      pending,
      'session.restore',
      payload,
      () => ack(latest, 'session.restore', payload),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'SESSION_REPLACED' },
    });
    const staleMessages: LobbyState[] = [];
    pending.on('lobby.roster', (value: LobbyState) =>
      staleMessages.push(value),
    );
    const state = nextState(latest);
    const bob = admission(await joinConnection('Bob'));
    expect(await state).toEqual(bob.state);
    expect(staleMessages).toEqual([]);
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
    const host = await connectHost();
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

  it.each(['host.bind', 'state.sync'])(
    'revalidates host tokens for %s after logout',
    async (event) => {
      const host = await connectHost();
      await request(server)
        .post('/auth/logout')
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(await ack(host, event, { roomId: room.roomId })).toMatchObject({
        ok: false,
        error: { code: 'UNAUTHORIZED' },
      });
    },
  );

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
    const host = await connectHost();
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
    const host = await connectHost();
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
    const host = await connectHost();
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
