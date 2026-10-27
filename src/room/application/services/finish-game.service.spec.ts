import { FinishGameService } from './finish-game.service';
import { completedRoom } from '../../domain/game-report.fixture';
import type { GameReport } from '../../domain/game-report';
import { InMemoryRoomStore } from '../../infrastructure/adapters/out/in-memory-room.store';
import { LobbyLifecycleService } from './lobby-lifecycle.service';
import { SystemLobbyRuntime } from '../../infrastructure/adapters/out/system-lobby.runtime';

describe('Durable game finalization', () => {
  let rooms: InMemoryRoomStore;
  let lifecycle: LobbyLifecycleService;
  let service: FinishGameService;
  let roomId: string;
  let save: jest.Mock<Promise<GameReport>, [GameReport]>;
  let finished: jest.Mock;
  let closed: jest.Mock;
  const command = (overrides = {}) => ({
    roomId,
    ownerId: 'owner',
    connectionId: 'host',
    commandId: 'finish',
    expectedRevision: 5,
    ...overrides,
  });
  beforeEach(async () => {
    jest.useFakeTimers();
    rooms = new InMemoryRoomStore();
    const fixture = completedRoom();
    const created = await rooms.create(
      { ownerId: 'owner', quizId: 'quiz', requestId: 'create' },
      () => Promise.resolve(fixture.quiz),
    );
    roomId = created.roomId;
    rooms.mutate(roomId, () => ({
      ...fixture,
      roomId,
      createdAt: new Date().toISOString(),
    }));
    closed = jest.fn();
    finished = jest.fn();
    lifecycle = new LobbyLifecycleService(rooms, new SystemLobbyRuntime(), {
      closed,
    });
    lifecycle.track(rooms.findById(roomId)!);
    lifecycle.bind(roomId, 'owner', 'host');
    lifecycle.startPlaying(roomId, () => {});
    save = jest.fn((report) => Promise.resolve(report));
    service = new FinishGameService(
      rooms,
      lifecycle,
      { saveOnce: save },
      { finished },
      {
        now: () => Date.now(),
        wallNow: () => Date.now(),
        schedule: () => () => {},
      },
    );
  });
  afterEach(() => {
    lifecycle.onModuleDestroy();
    jest.useRealTimers();
  });
  it('keeps reveal while saving and announces finished only after the report is stored', async () => {
    let resolve!: (report: GameReport) => void;
    save.mockImplementation(
      (report) =>
        new Promise((done) => {
          resolve = () => done(report);
        }),
    );
    const pending = service.finish(command());
    expect(rooms.findById(roomId)?.phase).toBe('question_reveal');
    expect(rooms.findById(roomId)?.finalizing).toBe(true);
    expect(finished).not.toHaveBeenCalled();
    resolve(save.mock.calls[0][0]);
    const state = await pending;
    expect(state.phase).toBe('finished');
    expect(state.report.id).toBe(roomId);
    expect(rooms.findById(roomId)?.revision).toBe(6);
    expect(finished).toHaveBeenCalledWith(state);
  });
  it('returns the same report after a lost completion acknowledgement without another write', async () => {
    const first = await service.finish(command());
    expect(await service.finish(command())).toEqual(first);
    expect(save).toHaveBeenCalledTimes(1);
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent finalization into one storage write and one completion', async () => {
    let release!: () => void;
    save.mockImplementation(
      (report) =>
        new Promise((resolve) => {
          release = () => resolve(report);
        }),
    );
    const first = service.finish(command());
    const second = service.finish(command({ commandId: 'another-finish' }));
    release();
    expect(await first).toEqual(await second);
    expect(save).toHaveBeenCalledTimes(1);
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it('retries a failed save with the same immutable candidate and unchanged scores', async () => {
    save.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.finish(command())).rejects.toMatchObject({
      code: 'REPORT_SAVE_FAILED',
    });
    expect(rooms.findById(roomId)).toMatchObject({
      phase: 'question_reveal',
      revision: 5,
      finalizing: false,
    });
    expect(finished).not.toHaveBeenCalled();
    jest.setSystemTime(Date.now() + 10_000);
    const result = await service.finish(command());
    expect(result.report).toEqual(save.mock.calls[0][0]);
    expect(save.mock.calls[1][0]).toBe(save.mock.calls[0][0]);
  });

  it('rejects cancellation while saving and ignores an expired host-absence callback after completion', async () => {
    let release!: () => void;
    save.mockImplementation(
      (report) =>
        new Promise((resolve) => {
          release = () => resolve(report);
        }),
    );
    const pending = service.finish(command());
    expect(() => lifecycle.cancel(roomId, 'owner', 'host')).toThrow(
      'Finalization',
    );
    lifecycle.disconnect(roomId, 'host');
    jest.advanceTimersByTime(120_001);
    expect(closed).not.toHaveBeenCalled();
    release();
    await pending;
    jest.runOnlyPendingTimers();
    expect(closed).not.toHaveBeenCalled();
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it('reevaluates an expired host absence when persistence fails without announcing completion', async () => {
    let fail!: (error: Error) => void;
    save.mockImplementation(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    const pending = service.finish(command());
    lifecycle.disconnect(roomId, 'host');
    jest.advanceTimersByTime(120_001);
    expect(closed).not.toHaveBeenCalled();
    fail(new Error('storage unavailable'));
    await expect(pending).rejects.toMatchObject({ code: 'REPORT_SAVE_FAILED' });
    expect(closed).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'HOST_TIMEOUT' }),
    );
    expect(finished).not.toHaveBeenCalled();
  });

  it('uses the already stored report when persistence succeeded but its response was lost', async () => {
    let stored: GameReport | undefined;
    save.mockImplementationOnce((candidate) => {
      stored = candidate;
      return Promise.reject(new Error('response lost'));
    });
    await expect(service.finish(command())).rejects.toMatchObject({
      code: 'REPORT_SAVE_FAILED',
    });
    save.mockImplementationOnce(() => Promise.resolve(stored!));
    expect((await service.finish(command())).report).toEqual(stored);
    expect(finished).toHaveBeenCalledTimes(1);
  });
  it.each([
    [{ ownerId: 'foreign' }, 'FORBIDDEN'],
    [{ connectionId: 'replaced' }, 'SESSION_REPLACED'],
    [{ expectedRevision: 4 }, 'STALE_REVISION'],
  ])(
    'rejects invalid finalization authority or revision %j',
    async (overrides, code) => {
      await expect(service.finish(command(overrides))).rejects.toMatchObject({
        code,
      });
      expect(save).not.toHaveBeenCalled();
    },
  );
  it.each(['lobby', 'question_open'] as const)(
    'rejects finishing from %s',
    async (phase) => {
      rooms.mutate(roomId, (room) => ({ ...room, phase }));
      await expect(service.finish(command())).rejects.toMatchObject({
        code: 'WRONG_PHASE',
      });
      expect(save).not.toHaveBeenCalled();
    },
  );
  it('rejects finishing from a non-final reveal', async () => {
    rooms.mutate(roomId, (room) => ({
      ...room,
      quiz: {
        ...room.quiz,
        questions: [
          ...room.quiz.questions,
          { ...room.quiz.questions[0], id: 'later' },
        ],
      },
    }));
    await expect(service.finish(command())).rejects.toMatchObject({
      code: 'WRONG_PHASE',
    });
    expect(save).not.toHaveBeenCalled();
  });
  it('rejects command ID reuse from progression', async () => {
    await expect(
      service.finish(command({ commandId: 'start' })),
    ).rejects.toMatchObject({ code: 'COMMAND_CONFLICT' });
    expect(save).not.toHaveBeenCalled();
  });
  it('allows owner cancellation again after a failed save', async () => {
    save.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(service.finish(command())).rejects.toMatchObject({
      code: 'REPORT_SAVE_FAILED',
    });
    expect(lifecycle.cancel(roomId, 'owner', 'host').reason).toBe(
      'OWNER_CANCELLED',
    );
    expect(finished).not.toHaveBeenCalled();
  });
  it('rejects changed content on an acknowledged finish command', async () => {
    await service.finish(command());
    await expect(
      service.finish(command({ expectedRevision: 6 })),
    ).rejects.toMatchObject({ code: 'COMMAND_CONFLICT' });
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('retries the accepted finish after roster connection changes increased the revision', async () => {
    save.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(service.finish(command())).rejects.toMatchObject({
      code: 'REPORT_SAVE_FAILED',
    });
    rooms.mutate(roomId, (room) => ({ ...room, revision: room.revision + 1 }));
    const result = await service.finish(command());
    expect(result.report).toEqual(save.mock.calls[0][0]);
    expect(result.revision).toBe(7);
  });
  it('rearms a future host-absence deadline after save failure', async () => {
    let fail!: (error: Error) => void;
    save.mockImplementation(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    const pending = service.finish(command());
    lifecycle.disconnect(roomId, 'host');
    jest.advanceTimersByTime(10_000);
    fail(new Error('storage unavailable'));
    await expect(pending).rejects.toMatchObject({ code: 'REPORT_SAVE_FAILED' });
    expect(closed).not.toHaveBeenCalled();
    jest.advanceTimersByTime(110_000);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(finished).not.toHaveBeenCalled();
  });
});
