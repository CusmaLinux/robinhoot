import { InMemoryRoomStore } from '../../infrastructure/adapters/out/in-memory-room.store';
import { SystemLobbyRuntime } from '../../infrastructure/adapters/out/system-lobby.runtime';
import { LobbyLifecycleService } from './lobby-lifecycle.service';
import type { Room } from '../../domain/room';
import { LobbyService } from './lobby.service';
import { RandomGuestCredentialIssuer } from '../../infrastructure/adapters/out/random-guest-credential.issuer';

describe('Lobby lifecycle', () => {
  let rooms: InMemoryRoomStore;
  let room: Room;
  let lifecycle: LobbyLifecycleService;
  let callbacks: (() => void)[];
  let events: { closed: jest.Mock };
  const snapshot = () =>
    Promise.resolve({
      version: 1 as const,
      sourceQuizId: 'quiz',
      title: 'Quiz',
      questions: [],
    });
  beforeEach(async () => {
    jest.useFakeTimers();
    rooms = new InMemoryRoomStore(() => '000001');
    room = await rooms.create(
      { ownerId: 'owner', quizId: 'quiz', requestId: 'create' },
      snapshot,
    );
    callbacks = [];
    events = { closed: jest.fn() };
    const runtime = new SystemLobbyRuntime();
    lifecycle = new LobbyLifecycleService(
      rooms,
      {
        now: () => runtime.now(),
        schedule: (at, callback) => {
          callbacks.push(callback);
          return runtime.schedule(at, callback);
        },
      },
      events,
    );
    lifecycle.track(room);
  });
  afterEach(() => {
    lifecycle.onModuleDestroy();
    jest.useRealTimers();
  });

  it('lets the owner cancel and releases room credentials, receipts, indexes and timers', async () => {
    const lobby = new LobbyService(
      rooms,
      new RandomGuestCredentialIssuer(),
      lifecycle,
    );
    const guest = lobby.join({
      pin: room.pin,
      nickname: 'Alice',
      requestId: 'join',
      connectionId: 'guest',
    });
    lifecycle.bind(room.roomId, 'owner', 'host');
    lifecycle.disconnect(room.roomId, 'host');
    expect(lifecycle.cancel(room.roomId, 'owner')).toEqual({
      roomId: room.roomId,
      phase: 'closed',
      reason: 'OWNER_CANCELLED',
      revision: 2,
    });
    expect(rooms.findById(room.roomId)).toBeNull();
    expect(rooms.findByPin(room.pin)).toBeNull();
    expect(() =>
      lobby.restore({
        roomId: room.roomId,
        credential: guest.credential,
        connectionId: 'return',
      }),
    ).toThrow('OWNER_CANCELLED');
    expect(jest.getTimerCount()).toBe(0);
    expect(
      (
        await rooms.create(
          { ownerId: 'owner', quizId: 'quiz', requestId: 'create' },
          snapshot,
        )
      ).roomId,
    ).not.toBe(room.roomId);
  });
  it('returns the original closure on repeated cancellation without publishing twice', () => {
    const first = lifecycle.cancel(room.roomId, 'owner');
    first.reason = 'HOST_TIMEOUT'; // callers cannot alter the retained receipt
    expect(lifecycle.cancel(room.roomId, 'owner').reason).toBe(
      'OWNER_CANCELLED',
    );
    callbacks.forEach((callback) => callback());
    expect(events.closed).toHaveBeenCalledTimes(1);
  });
  it('expires thirty minutes after creation without extending on repeated track or host return', () => {
    jest.advanceTimersByTime(1_700_000);
    lifecycle.track(room);
    lifecycle.bind(room.roomId, 'owner', 'host');
    lifecycle.disconnect(room.roomId, 'host');
    jest.advanceTimersByTime(99_999);
    lifecycle.bind(room.roomId, 'owner', 'returned');
    expect(events.closed).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(events.closed).toHaveBeenCalledWith({
      roomId: room.roomId,
      phase: 'closed',
      reason: 'LOBBY_EXPIRED',
      revision: 1,
    });
    callbacks.forEach((callback) => callback());
    expect(events.closed).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  it('preserves the roster on timely return and ignores stale absence callbacks and disconnects', () => {
    lifecycle.bind(room.roomId, 'owner', 'host-1');
    lifecycle.disconnect(room.roomId, 'host-1');
    lifecycle.disconnect(room.roomId, 'host-1');
    jest.advanceTimersByTime(119_999);
    lifecycle.bind(room.roomId, 'owner', 'host-2');
    callbacks.slice(1).forEach((callback) => callback());
    lifecycle.disconnect(room.roomId, 'host-1');
    expect(events.closed).not.toHaveBeenCalled();
    expect(rooms.findById(room.roomId)).toEqual(room);
    lifecycle.disconnect(room.roomId, 'host-2');
    jest.advanceTimersByTime(120_000);
    expect(events.closed).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'HOST_TIMEOUT' }),
    );
    expect(jest.getTimerCount()).toBe(0);
  });
  it('rejects return at the deadline even when the scheduler has not dispatched yet', () => {
    lifecycle.bind(room.roomId, 'owner', 'host');
    lifecycle.disconnect(room.roomId, 'host');
    jest.setSystemTime(Date.now() + 120_000);
    expect(() => lifecycle.bind(room.roomId, 'owner', 'late')).toThrow(
      'HOST_TIMEOUT',
    );
    expect(events.closed).toHaveBeenCalledTimes(1);
  });
  it('rejects foreign owners without altering the reconnect deadline', () => {
    lifecycle.bind(room.roomId, 'owner', 'host');
    lifecycle.disconnect(room.roomId, 'host');
    expect(() => lifecycle.bind(room.roomId, 'other', 'thief')).toThrow(
      'Room is not owned',
    );
    expect(() => lifecycle.cancel(room.roomId, 'other')).toThrow(
      'Room is not owned',
    );
    jest.advanceTimersByTime(120_000);
    expect(events.closed).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'HOST_TIMEOUT' }),
    );
  });
  it('removes authority from a replaced host connection', () => {
    lifecycle.bind(room.roomId, 'owner', 'old');
    expect(lifecycle.bind(room.roomId, 'owner', 'new')).toBe('old');
    expect(() => lifecycle.assertHost(room.roomId, 'owner', 'old')).toThrow(
      'Connection no longer controls',
    );
    expect(() => lifecycle.cancel(room.roomId, 'owner', 'old')).toThrow(
      'Connection no longer controls',
    );
    lifecycle.disconnect(room.roomId, 'old');
    jest.advanceTimersByTime(120_000);
    lifecycle.assertHost(room.roomId, 'owner', 'new');
  });
  it('does not let old callbacks close a replacement room using the same PIN and owner', async () => {
    lifecycle.cancel(room.roomId, 'owner');
    const next = await rooms.create(
      { ownerId: 'owner', quizId: 'quiz', requestId: 'new' },
      snapshot,
    );
    lifecycle.track(next);
    callbacks.slice(0, 1).forEach((callback) => callback());
    expect(rooms.findByPin(room.pin)?.roomId).toBe(next.roomId);
    expect(events.closed).toHaveBeenCalledTimes(1);
  });
  it('forgets closure tombstones after five minutes', () => {
    lifecycle.cancel(room.roomId, 'owner');
    jest.advanceTimersByTime(300_000);
    expect(() => lifecycle.cancel(room.roomId, 'owner')).toThrow(
      'Room is not owned',
    );
  });
  it('bounds closure tombstones to the most recent thousand rooms', async () => {
    lifecycle.cancel(room.roomId, 'owner');
    let last = room;
    for (let index = 0; index < 1000; index++) {
      last = await rooms.create(
        { ownerId: 'owner', quizId: 'quiz', requestId: String(index) },
        snapshot,
      );
      lifecycle.track(last);
      lifecycle.cancel(last.roomId, 'owner');
    }
    expect(() => lifecycle.cancel(room.roomId, 'owner')).toThrow(
      'Room is not owned',
    );
    expect(lifecycle.cancel(last.roomId, 'owner').reason).toBe(
      'OWNER_CANCELLED',
    );
  });
  it('uses the earliest deadline when both scheduled callbacks are delayed', () => {
    lifecycle.bind(room.roomId, 'owner', 'host');
    lifecycle.disconnect(room.roomId, 'host');
    jest.setSystemTime(Date.now() + 1_800_000);
    callbacks[0]();
    expect(events.closed).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'HOST_TIMEOUT' }),
    );
  });
  it('rejects admission at expiry even before the timer callback dispatches', () => {
    const lobby = new LobbyService(
      rooms,
      new RandomGuestCredentialIssuer(),
      lifecycle,
    );
    jest.setSystemTime(Date.now() + 1_800_000);
    expect(() =>
      lobby.join({
        pin: room.pin,
        nickname: 'Alice',
        requestId: 'join',
        connectionId: 'guest',
      }),
    ).toThrow('LOBBY_EXPIRED');
    expect(rooms.findByPin(room.pin)).toBeNull();
  });
  it('clears active timers when the module shuts down', () => {
    lifecycle.bind(room.roomId, 'owner', 'host');
    lifecycle.disconnect(room.roomId, 'host');
    lifecycle.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
    expect(events.closed).not.toHaveBeenCalled();
  });
});
