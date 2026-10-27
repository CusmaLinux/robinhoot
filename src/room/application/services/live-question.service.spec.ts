import { SystemQuestionRuntime } from '../../infrastructure/adapters/out/system-question.runtime';
import { InMemoryRoomStore } from '../../infrastructure/adapters/out/in-memory-room.store';
import { SystemLobbyRuntime } from '../../infrastructure/adapters/out/system-lobby.runtime';
import { RandomGuestCredentialIssuer } from '../../infrastructure/adapters/out/random-guest-credential.issuer';
import { LobbyLifecycleService } from './lobby-lifecycle.service';
import { LobbyService } from './lobby.service';
import { LiveQuestionService } from './live-question.service';
import type { Room } from '../../domain/room';

describe('Timed first question', () => {
  let rooms: InMemoryRoomStore;
  let room: Room;
  let lobby: LobbyService;
  let lifecycle: LobbyLifecycleService;
  let live: LiveQuestionService;
  let events: { opened: jest.Mock; revealed: jest.Mock };
  let callbacks: (() => void)[];
  let monotonic: number;
  const start = (overrides = {}) =>
    live.start({
      roomId: room.roomId,
      ownerId: 'owner',
      connectionId: 'host',
      commandId: 'start',
      expectedRevision: 1,
      ...overrides,
    });
  const submit = (overrides = {}) =>
    live.submit({
      roomId: room.roomId,
      connectionId: 'guest',
      questionId: 'question',
      submissionId: 'submission',
      optionId: 'b',
      ...overrides,
    });
  beforeEach(async () => {
    jest.useFakeTimers();
    monotonic = 100;
    callbacks = [];
    rooms = new InMemoryRoomStore();
    room = await rooms.create(
      { ownerId: 'owner', quizId: 'quiz', requestId: 'create' },
      () =>
        Promise.resolve({
          version: 1,
          sourceQuizId: 'quiz',
          title: 'Quiz',
          questions: [
            {
              id: 'question',
              type: 'multiple-choice',
              prompt: 'First?',
              options: ['a', 'b', 'c', 'd'].map((id) => ({
                id,
                text: id.toUpperCase(),
              })),
              correctOptionIds: ['b'],
              durationSeconds: 20,
            },
            ...[30, 10].map((durationSeconds, index) => ({
              id: `question-${index + 2}`,
              type: 'multiple-choice' as const,
              prompt: `Question ${index + 2}?`,
              options: ['a', 'b', 'c', 'd'].map((id) => ({ id, text: id })),
              correctOptionIds: ['b'],
              durationSeconds,
            })),
          ],
        }),
    );
    lifecycle = new LobbyLifecycleService(rooms, new SystemLobbyRuntime(), {
      closed: () => {},
    });
    lifecycle.track(room);
    lifecycle.bind(room.roomId, 'owner', 'host');
    lobby = new LobbyService(
      rooms,
      new RandomGuestCredentialIssuer(),
      lifecycle,
    );
    lobby.join({
      pin: room.pin,
      nickname: 'Alice',
      requestId: 'join',
      connectionId: 'guest',
    });
    events = { opened: jest.fn(), revealed: jest.fn() };
    live = new LiveQuestionService(
      rooms,
      lifecycle,
      {
        now: () => monotonic,
        wallNow: () => Date.now(),
        schedule: (at, callback) => {
          callbacks.push(callback);
          const timer = setTimeout(callback, Math.max(0, at - monotonic));
          return () => clearTimeout(timer);
        },
      },
      events,
    );
  });
  afterEach(() => {
    live?.onModuleDestroy();
    lifecycle.onModuleDestroy();
    jest.useRealTimers();
  });
  it('opens exactly the next snapshot question with a fresh full duration after waiting at reveal', () => {
    start();
    monotonic += 20_000;
    live.close(room.roomId);
    monotonic += 5_000;
    jest.setSystemTime(Date.now() + 25_000);
    const revealed = live.snapshot(room.roomId)!;
    const next = live.next({
      roomId: room.roomId,
      ownerId: 'owner',
      connectionId: 'host',
      commandId: 'next-2',
      expectedRevision: revealed.revision,
    });
    expect(next).toMatchObject({
      questionId: 'question-2',
      phase: 'question_open',
      revision: revealed.revision + 1,
      openedAt: Date.now(),
      deadline: Date.now() + 30_000,
    });
    expect(rooms.findById(room.roomId)?.round?.monotonicDeadline).toBe(
      monotonic + 30_000,
    );
    expect(events.opened).toHaveBeenCalledTimes(2);
  });
  const next = (overrides = {}) =>
    live.next({
      roomId: room.roomId,
      ownerId: 'owner',
      connectionId: 'host',
      commandId: 'next-2',
      expectedRevision: rooms.findById(room.roomId)?.revision ?? 0,
      ...overrides,
    });
  const reveal = (milliseconds = 20_000) => {
    monotonic += milliseconds;
    live.close(room.roomId);
  };
  it('recognizes old next and start retries after later questions without skipping or resetting', () => {
    start();
    reveal();
    const revision = rooms.findById(room.roomId)!.revision;
    const opened = next({ expectedRevision: revision });
    expect(next({ expectedRevision: revision }).deadline).toBe(opened.deadline);
    reveal(30_000);
    next({ commandId: 'next-3' });
    const current = rooms.findById(room.roomId);
    expect(next({ expectedRevision: revision }).questionId).toBe('question-3');
    expect(start().questionId).toBe('question-3');
    expect(rooms.findById(room.roomId)).toBe(current);
    expect(events.opened).toHaveBeenCalledTimes(3);
  });
  it('preserves cumulative scores while clearing only the new question acceptance state', () => {
    start();
    submit();
    reveal();
    next();
    expect(live.snapshot(room.roomId, 'guest')).toMatchObject({
      score: 1000,
      acceptedAnswer: null,
    });
    submit({ questionId: 'question-2', submissionId: 'second-answer' });
    reveal(30_000);
    expect(live.snapshot(room.roomId, 'guest')?.score).toBe(2000);
    callbacks.forEach((callback) => callback());
    expect(live.snapshot(room.roomId, 'guest')?.score).toBe(2000);
    expect(rooms.findById(room.roomId)?.previousRounds).toHaveLength(1);
  });
  it('returns an accepted old-question receipt after progression without altering the new round', () => {
    start();
    const receipt = submit();
    reveal();
    next();
    const current = rooms.findById(room.roomId);
    expect(submit()).toEqual(receipt);
    expect(rooms.findById(room.roomId)).toBe(current);
    expect(() => submit({ optionId: 'a' })).toThrow(
      expect.objectContaining({ code: 'SUBMISSION_CONFLICT' }) as Error,
    );
    expect(() => submit({ submissionId: 'new-old-answer' })).toThrow(
      expect.objectContaining({ code: 'ALREADY_ANSWERED' }) as Error,
    );
  });
  it.each([
    ['foreign owner', { ownerId: 'foreign' }, 'FORBIDDEN'],
    ['replaced host', { connectionId: 'obsolete' }, 'SESSION_REPLACED'],
    ['stale revision', { expectedRevision: 0 }, 'STALE_REVISION'],
    [
      'start ID reused as next',
      { commandId: 'start', expectedRevision: 1 },
      'COMMAND_CONFLICT',
    ],
  ])('rejects next from %s without changing reveal', (_name, input, code) => {
    start();
    reveal();
    const current = rooms.findById(room.roomId);
    expect(() => next(input)).toThrow(
      expect.objectContaining({ code }) as Error,
    );
    expect(rooms.findById(room.roomId)).toBe(current);
  });
  it('rejects a new next command while open without resetting the question', () => {
    start();
    const current = rooms.findById(room.roomId);
    expect(() => next()).toThrow(
      expect.objectContaining({ code: 'WRONG_PHASE' }) as Error,
    );
    expect(rooms.findById(room.roomId)).toBe(current);
  });
  it('rejects next from the lobby', () => {
    expect(() => next()).toThrow(
      expect.objectContaining({ code: 'WRONG_PHASE' }) as Error,
    );
  });
  it('rejects changed content for an old next receipt and cross-command ID reuse', () => {
    start();
    reveal();
    const revision = rooms.findById(room.roomId)!.revision;
    next();
    reveal(30_000);
    expect(() => next({ expectedRevision: revision + 1 })).toThrow(
      expect.objectContaining({ code: 'COMMAND_CONFLICT' }) as Error,
    );
    expect(() =>
      start({ commandId: 'next-2', expectedRevision: revision }),
    ).toThrow(expect.objectContaining({ code: 'COMMAND_CONFLICT' }) as Error);
  });
  it('rejects a new next after the final reveal but acknowledges an accepted retry', () => {
    start();
    reveal();
    next();
    reveal(30_000);
    const revision = rooms.findById(room.roomId)!.revision;
    next({ commandId: 'next-3' });
    reveal(10_000);
    const current = rooms.findById(room.roomId);
    expect(() => next({ commandId: 'past-final' })).toThrow(
      expect.objectContaining({ code: 'NO_MORE_QUESTIONS' }) as Error,
    );
    expect(
      next({ commandId: 'next-3', expectedRevision: revision }).phase,
    ).toBe('question_reveal');
    expect(rooms.findById(room.roomId)).toBe(current);
  });
  it('keeps disconnected starting players eligible for later questions and awards missing zero', () => {
    start();
    lobby.disconnect(room.roomId, 'guest');
    reveal();
    next();
    reveal(30_000);
    expect(rooms.findById(room.roomId)?.round?.eligiblePlayerIds).toHaveLength(
      1,
    );
    expect(rooms.findById(room.roomId)?.round?.scores[0].points).toBe(0);
  });
  it('rejects a new old-question answer after progression', () => {
    start();
    reveal();
    next();
    expect(() => submit()).toThrow(
      expect.objectContaining({ code: 'WRONG_QUESTION' }) as Error,
    );
  });
  it.each(['question_open', 'question_reveal'])(
    'cancels a later %s and invalidates every retained command and answer',
    (phase) => {
      start();
      submit();
      reveal();
      next();
      if (phase === 'question_reveal') reveal(30_000);
      const closure = lifecycle.cancel(room.roomId, 'owner', 'host');
      expect(closure).toMatchObject({
        phase: 'closed',
        reason: 'OWNER_CANCELLED',
      });
      expect(rooms.findById(room.roomId)).toBeNull();
      expect(() => next()).toThrow(
        expect.objectContaining({ code: 'ROOM_CLOSED' }) as Error,
      );
      expect(() => start()).toThrow(
        expect.objectContaining({ code: 'ROOM_CLOSED' }) as Error,
      );
      expect(() => submit()).toThrow(
        expect.objectContaining({ code: 'ROOM_CLOSED' }) as Error,
      );
      const published = events.revealed.mock.calls.length;
      callbacks.forEach((callback) => callback());
      expect(events.revealed).toHaveBeenCalledTimes(published);
      expect(jest.getTimerCount()).toBe(0);
      expect(lifecycle.cancel(room.roomId, 'owner', 'host')).toEqual(closure);
    },
  );
  it('accepts one answer for the current bound guest without revealing correctness', () => {
    start();
    const receipt = live.submit({
      roomId: room.roomId,
      connectionId: 'guest',
      questionId: 'question',
      submissionId: 'submission',
      optionId: 'b',
    });
    expect(receipt).toEqual({
      roomId: room.roomId,
      questionId: 'question',
      submissionId: 'submission',
      optionId: 'b',
      accepted: true,
      acceptedAt: Date.now(),
      revision: 3,
    });
    expect(rooms.findById(room.roomId)?.revision).toBe(3);
    expect(events.revealed).not.toHaveBeenCalled();
  });
  it('returns the original receipt for an accepted retry even after reveal', () => {
    start();
    const receipt = submit();
    monotonic += 20_000;
    live.close(room.roomId);
    const revision = rooms.findById(room.roomId)!.revision;
    expect(submit()).toEqual(receipt);
    expect(rooms.findById(room.roomId)!.revision).toBe(revision);
  });
  it('rejects a different second submission without replacing the first answer', () => {
    start();
    submit();
    const before = rooms.findById(room.roomId);
    expect(() => submit({ submissionId: 'second', optionId: 'a' })).toThrow(
      expect.objectContaining({ code: 'ALREADY_ANSWERED' }) as Error,
    );
    expect(rooms.findById(room.roomId)).toBe(before);
  });
  it('rejects changed content under an accepted submission ID', () => {
    start();
    submit();
    const before = rooms.findById(room.roomId);
    expect(() => submit({ optionId: 'a' })).toThrow(
      expect.objectContaining({ code: 'SUBMISSION_CONFLICT' }) as Error,
    );
    expect(rooms.findById(room.roomId)).toBe(before);
  });
  it('rejects a new answer at the exact deadline before a delayed close callback', () => {
    start();
    monotonic += 20_000;
    const before = rooms.findById(room.roomId);
    expect(() => submit()).toThrow(
      expect.objectContaining({ code: 'LATE_ANSWER' }) as Error,
    );
    expect(rooms.findById(room.roomId)).toBe(before);
  });
  it('awards a correct accepted answer 1000 points exactly once at reveal', () => {
    start();
    submit();
    monotonic += 20_000;
    live.close(room.roomId);
    callbacks.forEach((callback) => callback());
    expect(live.snapshot(room.roomId, 'guest')).toMatchObject({ score: 1000 });
    expect(events.revealed).toHaveBeenCalledTimes(1);
  });
  it('restores only the returning guest acceptance without early correctness', () => {
    start();
    const receipt = submit();
    expect(live.snapshot(room.roomId, 'guest')).toMatchObject({
      acceptedAnswer: receipt,
      score: 0,
      phase: 'question_open',
    });
    expect(live.snapshot(room.roomId)).not.toHaveProperty('acceptedAnswer');
    expect(live.snapshot(room.roomId, 'guest')).not.toHaveProperty(
      'correctOptionIds',
    );
  });
  it.each([
    ['wrong question', { questionId: 'old-question' }, 'WRONG_QUESTION'],
    ['unknown option', { optionId: 'foreign-option' }, 'INVALID_OPTION'],
    ['unbound connection', { connectionId: 'stranger' }, 'SESSION_REPLACED'],
    ['host connection', { connectionId: 'host' }, 'SESSION_REPLACED'],
  ])('rejects %s without mutation', (_name, input, code) => {
    start();
    const before = rooms.findById(room.roomId);
    expect(() => submit(input)).toThrow(
      expect.objectContaining({ code }) as Error,
    );
    expect(rooms.findById(room.roomId)).toBe(before);
  });

  it('accepts just before the deadline even when the wall clock jumps forward', () => {
    start();
    monotonic += 19_999;
    jest.setSystemTime(Date.now() + 3_600_000);
    expect(submit().accepted).toBe(true);
  });

  it('rejects a new answer after reveal even when the callback ran first', () => {
    start();
    monotonic += 20_001;
    callbacks[0]();
    const before = rooms.findById(room.roomId);
    expect(() => submit()).toThrow(
      expect.objectContaining({ code: 'LATE_ANSWER' }) as Error,
    );
    expect(rooms.findById(room.roomId)).toBe(before);
  });

  it('does not shorten the timer when all eligible players have answered', () => {
    const opened = start();
    submit();
    monotonic += 19_999;
    expect(live.snapshot(room.roomId, 'guest')).toMatchObject({
      phase: 'question_open',
      score: 0,
      deadline: opened.deadline,
    });
    expect(events.revealed).not.toHaveBeenCalled();
  });

  it('gives a wrong accepted answer zero points at reveal', () => {
    start();
    submit({ optionId: 'a' });
    monotonic += 20_000;
    live.close(room.roomId);
    expect(live.snapshot(room.roomId, 'guest')?.score).toBe(0);
  });

  it('returns an accepted retry before closure without mutation or receipt aliasing', () => {
    start();
    const receipt = submit();
    const revision = rooms.findById(room.roomId)!.revision;
    monotonic += 500;
    jest.advanceTimersByTime(500);
    expect(submit()).toEqual(receipt);
    expect(rooms.findById(room.roomId)!.revision).toBe(revision);
    Object.assign(receipt, { optionId: 'a' });
    expect(submit().optionId).toBe('b');
  });

  it('denies a replaced connection access to its old receipt', () => {
    start();
    submit();
    const guest = rooms.findById(room.roomId)!.guests[0];
    lobby.restore({
      roomId: room.roomId,
      credential: guest.admission.credential,
      connectionId: 'replacement',
    });
    expect(() => submit()).toThrow(
      expect.objectContaining({ code: 'SESSION_REPLACED' }) as Error,
    );
    expect(submit({ connectionId: 'replacement' }).accepted).toBe(true);
  });

  it('invalidates accepted receipts when the room is cancelled', () => {
    start();
    submit();
    lifecycle.cancel(room.roomId, 'owner');
    expect(() => submit()).toThrow(
      expect.objectContaining({ code: 'ROOM_CLOSED' }) as Error,
    );
  });
  it('rejects a submission before any question opens without mutation', () => {
    const before = rooms.findById(room.roomId);
    expect(() => submit()).toThrow(
      expect.objectContaining({ code: 'WRONG_PHASE' }) as Error,
    );
    expect(rooms.findById(room.roomId)).toBe(before);
  });

  it('preserves conflict errors after reveal instead of treating accepted players as late', () => {
    start();
    const receipt = submit();
    monotonic += 20_000;
    live.close(room.roomId);
    expect(() => submit({ optionId: 'a' })).toThrow(
      expect.objectContaining({ code: 'SUBMISSION_CONFLICT' }) as Error,
    );
    expect(() => submit({ submissionId: 'new' })).toThrow(
      expect.objectContaining({ code: 'ALREADY_ANSWERED' }) as Error,
    );
    expect(submit()).toEqual(receipt);
    expect(live.snapshot(room.roomId, 'guest')?.score).toBe(1000);
  });

  it('opens the first snapshot question for the owner and freezes eligibility', () => {
    const opened = start();
    expect(opened).toMatchObject({
      roomId: room.roomId,
      questionId: 'question',
      phase: 'question_open',
      revision: 2,
      deadline: Date.now() + 20_000,
      eligiblePlayerIds: [rooms.findById(room.roomId)!.guests[0].playerId],
    });
    expect(events.opened).toHaveBeenCalledTimes(1);
    expect(rooms.findById(room.roomId)?.phase).toBe('question_open');
  });
  it('rejects an empty lobby without opening or scheduling a round', () => {
    rooms.mutate(room.roomId, (current) => ({ ...current, guests: [] }));
    expect(() => start()).toThrow('At least one joined player is required');
    expect(events.opened).not.toHaveBeenCalled();
    expect(callbacks).toHaveLength(0);
  });

  it('replays an accepted command without changing the deadline or revision', () => {
    const first = start();
    monotonic += 500;
    jest.advanceTimersByTime(500);
    expect(start()).toMatchObject({
      deadline: first.deadline,
      openedAt: first.openedAt,
      revision: first.revision,
    });
    expect(events.opened).toHaveBeenCalledTimes(1);
  });

  it('rejects another start command after opening', () => {
    start();
    expect(() => start({ commandId: 'other', expectedRevision: 2 })).toThrow(
      'First question can only start from the lobby',
    );
    expect(events.opened).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of an accepted command with a different revision fingerprint', () => {
    start();
    expect(() => start({ expectedRevision: 2 })).toThrow(
      'Start command was accepted with different content',
    );
    expect(events.opened).toHaveBeenCalledTimes(1);
  });

  it('rejects an unaccepted start against a stale revision', () => {
    expect(() => start({ expectedRevision: 0 })).toThrow(
      'Room revision has changed',
    );
    expect(rooms.findById(room.roomId)?.revision).toBe(1);
  });

  it('reveals once at the monotonic deadline even without any answers', () => {
    const opened = start();
    monotonic += 19_999;
    jest.advanceTimersByTime(19_999);
    expect(events.revealed).not.toHaveBeenCalled();
    monotonic += 1;
    jest.advanceTimersByTime(1);
    expect(events.revealed).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'question_reveal',
        revision: 3,
        correctOptionIds: ['b'],
        score: 0,
        deadline: opened.deadline,
      }),
      expect.any(Array),
    );
    callbacks.forEach((callback) => callback());
    expect(events.revealed).toHaveBeenCalledTimes(1);
  });

  it('settles reveal on a read at the cutoff before a delayed callback runs', () => {
    start();
    monotonic += 20_000;
    expect(live.snapshot(room.roomId)?.phase).toBe('question_reveal');
    callbacks.forEach((callback) => callback());
    expect(events.revealed).toHaveBeenCalledTimes(1);
    expect(start()).toMatchObject({ phase: 'question_reveal', revision: 3 });
  });

  it('cancels idle expiry on start so a question can finish past the lobby lifetime', () => {
    jest.advanceTimersByTime(1_799_999);
    monotonic += 1_799_999;
    start();
    monotonic += 20_000;
    jest.advanceTimersByTime(20_000);
    expect(live.snapshot(room.roomId)?.phase).toBe('question_reveal');
    expect(rooms.findById(room.roomId)).not.toBeNull();
  });

  it('reschedules an early callback instead of losing the authoritative deadline', () => {
    start();
    monotonic += 19_999;
    callbacks[0]();
    expect(events.revealed).not.toHaveBeenCalled();
    monotonic += 1;
    jest.advanceTimersByTime(1);
    expect(events.revealed).toHaveBeenCalledTimes(1);
  });
  it('denies another account without changing the lobby', () => {
    expect(() => start({ ownerId: 'foreign' })).toThrow(
      'Room is not owned by this account',
    );
    expect(rooms.findById(room.roomId)?.revision).toBe(1);
    expect(events.opened).not.toHaveBeenCalled();
  });

  it('denies an obsolete host connection even when retrying an accepted start', () => {
    start();
    lifecycle.bind(room.roomId, 'owner', 'replacement');
    expect(() => start()).toThrow('Connection no longer controls this host');
    expect(start({ connectionId: 'replacement' }).revision).toBe(2);
  });

  it('rejects late admission without changing frozen eligibility', () => {
    const opened = start();
    expect(() =>
      lobby.join({
        pin: room.pin,
        nickname: 'Bob',
        requestId: 'late',
        connectionId: 'late',
      }),
    ).toThrow('Room is closed');
    expect(live.snapshot(room.roomId)?.eligiblePlayerIds).toEqual(
      opened.eligiblePlayerIds,
    );
    expect(rooms.findById(room.roomId)?.guests).toHaveLength(1);
  });

  it('keeps a disconnected joined player eligible with zero points', () => {
    lobby.disconnect(room.roomId, 'guest');
    const opened = start({ expectedRevision: 2 });
    expect(opened.eligiblePlayerIds).toHaveLength(1);
    monotonic += 20_000;
    jest.advanceTimersByTime(20_000);
    expect(live.snapshot(room.roomId)).toMatchObject({
      score: 0,
      eligiblePlayerIds: opened.eligiblePlayerIds,
    });
  });

  it('publishes only explicit safe question fields while open', () => {
    const opened = start();
    expect(opened.question.options).toEqual(
      ['a', 'b', 'c', 'd'].map((id, index) => ({
        id,
        text: id.toUpperCase(),
        label: String.fromCharCode(65 + index),
      })),
    );
    expect(opened).not.toHaveProperty('correctOptionIds');
    expect(JSON.stringify(opened)).not.toMatch(
      /credential|correctOption|commandId|ownerId|monotonic/,
    );
    opened.eligiblePlayerIds.length = 0;
    opened.question.options[0].text = 'tampered';
    expect(live.snapshot(room.roomId)?.eligiblePlayerIds).toHaveLength(1);
    expect(live.snapshot(room.roomId)?.question.options[0].text).toBe('A');
  });

  it('ignores wall-clock jumps when deciding reveal', () => {
    const opened = start();
    jest.setSystemTime(Date.now() + 3_600_000);
    expect(live.snapshot(room.roomId)?.phase).toBe('question_open');
    jest.setSystemTime(Date.now() - 7_200_000);
    monotonic += 20_000;
    live.close(room.roomId);
    expect(live.snapshot(room.roomId)).toMatchObject({
      phase: 'question_reveal',
      deadline: opened.deadline,
    });
  });

  it('cancels the question timer and ignores stale callbacks after owner cancellation', () => {
    start();
    lifecycle.cancel(room.roomId, 'owner');
    expect(jest.getTimerCount()).toBe(0);
    monotonic += 20_000;
    callbacks.forEach((callback) => callback());
    expect(events.revealed).not.toHaveBeenCalled();
    expect(() => live.snapshot(room.roomId)).toThrow(
      expect.objectContaining({ code: 'ROOM_CLOSED' }) as Error,
    );
  });

  it('rejects a host snapshot at the absence cutoff even when cancellation callbacks are delayed', () => {
    start();
    lifecycle.disconnect(room.roomId, 'host');
    monotonic += 20_000;
    live.close(room.roomId);
    jest.setSystemTime(Date.now() + 120_000);
    expect(() => live.snapshot(room.roomId)).toThrow(
      expect.objectContaining({
        code: 'ROOM_CLOSED',
        message: 'HOST_TIMEOUT',
      }) as Error,
    );
    expect(rooms.findById(room.roomId)).toBeNull();
  });

  it('preserves the scored reveal when the owner returns just before the absence deadline', () => {
    const opened = start();
    const receipt = submit();
    lifecycle.disconnect(room.roomId, 'host');
    monotonic += 20_000;
    jest.advanceTimersByTime(20_000);
    const revealed = live.snapshot(room.roomId, 'guest');
    jest.advanceTimersByTime(99_999);
    lifecycle.bind(room.roomId, 'owner', 'returning-host');
    jest.advanceTimersByTime(1);
    expect(live.snapshot(room.roomId, 'guest')).toMatchObject({
      phase: 'question_reveal',
      revision: revealed!.revision,
      deadline: opened.deadline,
      acceptedAnswer: receipt,
      score: 1000,
    });
    expect(() => start({ connectionId: 'host' })).toThrow(
      expect.objectContaining({ code: 'SESSION_REPLACED' }) as Error,
    );
    expect(start({ connectionId: 'returning-host' })).toMatchObject({
      phase: 'question_reveal',
      revision: revealed!.revision,
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('closes on time while the host is absent', () => {
    start();
    lifecycle.disconnect(room.roomId, 'host');
    monotonic += 20_000;
    jest.advanceTimersByTime(20_000);
    expect(live.snapshot(room.roomId)?.phase).toBe('question_reveal');
    jest.advanceTimersByTime(100_000);
    expect(rooms.findById(room.roomId)).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects a new command at reveal without opening the second snapshot question', () => {
    start();
    monotonic += 20_000;
    live.close(room.roomId);
    expect(() => start({ commandId: 'next', expectedRevision: 3 })).toThrow(
      'First question can only start from the lobby',
    );
    expect(events.opened).toHaveBeenCalledTimes(1);
    expect(events.revealed).toHaveBeenCalledTimes(1);
  });

  it('releases the scheduled question callback on application shutdown', () => {
    start();
    live.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });
  it('reveals using the production scheduler under fake time', () => {
    const runtime = new SystemQuestionRuntime();
    expect(runtime.now()).toBeGreaterThanOrEqual(0);
    expect(runtime.wallNow()).toBe(Date.now());
    jest.spyOn(runtime, 'now').mockImplementation(() => monotonic);
    live.onModuleDestroy();
    live = new LiveQuestionService(rooms, lifecycle, runtime, events);
    start();
    monotonic += 20_000;
    jest.advanceTimersByTime(20_000);
    expect(events.revealed).toHaveBeenCalledTimes(1);
    expect(live.snapshot(room.roomId)).toMatchObject({
      phase: 'question_reveal',
      score: 0,
    });
    expect(jest.getTimerCount()).toBe(0);
  });
});
