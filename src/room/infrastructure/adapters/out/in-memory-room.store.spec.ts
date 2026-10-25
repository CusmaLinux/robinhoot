import { InMemoryRoomStore } from './in-memory-room.store';
import type { QuizSnapshot } from '../../../domain/room';

describe('In-memory room creation', () => {
  const snapshot: QuizSnapshot = {
    version: 1,
    sourceQuizId: 'quiz',
    title: 'Biology',
    questions: [],
  };
  const input = { ownerId: 'owner', quizId: 'quiz', requestId: 'request' };

  it('rejects a second room for an active owner', async () => {
    const store = new InMemoryRoomStore();
    await store.create(input, () => Promise.resolve(snapshot));
    await expect(
      store.create({ ...input, requestId: 'another' }, () =>
        Promise.resolve(snapshot),
      ),
    ).rejects.toMatchObject({ message: 'Owner already has an active room' });
  });

  it('serializes creation for one owner across a pending quiz lookup', async () => {
    const store = new InMemoryRoomStore();
    let resolve!: (quiz: QuizSnapshot) => void;
    const delayed = new Promise<QuizSnapshot>((done) => {
      resolve = done;
    });
    const first = store.create(input, () => delayed);
    const second = store.create({ ...input, requestId: 'another' }, () =>
      Promise.resolve(snapshot),
    );
    const result = Promise.allSettled([first, second]);
    resolve(snapshot);
    const outcomes = await result;
    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'fulfilled',
      'rejected',
    ]);
  });

  it('returns the original room for simultaneous retries without rereading the source', async () => {
    const store = new InMemoryRoomStore();
    const first = store.create(input, () => Promise.resolve(snapshot));
    const retry = store.create(input, () =>
      Promise.reject(new Error('Source deleted')),
    );
    expect(await retry).toEqual(await first);
  });

  it('rejects reuse of a successful request ID for a different quiz', async () => {
    const store = new InMemoryRoomStore();
    await store.create(input, () => Promise.resolve(snapshot));
    await expect(
      store.create({ ...input, quizId: 'different' }, () =>
        Promise.resolve(snapshot),
      ),
    ).rejects.toMatchObject({
      message: 'Request ID was already used for another quiz',
    });
  });

  it('retries a colliding PIN without changing the existing room', async () => {
    const pins = ['000001', '000001', '000002'];
    const store = new InMemoryRoomStore(() => pins.shift()!);
    const first = await store.create(input, () => Promise.resolve(snapshot));
    const second = await store.create({ ...input, ownerId: 'other' }, () =>
      Promise.resolve(snapshot),
    );
    expect([first.pin, second.pin]).toEqual(['000001', '000002']);
    expect(store.findById(first.roomId)).toEqual(first);
    expect(store.findByPin(first.pin)).toEqual(first);
    expect(store.findByPin(second.pin)).toEqual(second);
  });

  it('bounds PIN collision retries and releases the owner after allocation failure', async () => {
    let pin = '000001';
    let attempts = 0;
    const store = new InMemoryRoomStore(() => {
      attempts++;
      return pin;
    });
    const first = await store.create(input, () => Promise.resolve(snapshot));
    const other = { ...input, ownerId: 'other' };
    await expect(
      store.create(other, () => Promise.resolve(snapshot)),
    ).rejects.toMatchObject({
      message: 'Unable to allocate a room PIN; retry this request',
    });
    expect(attempts).toBe(33);
    pin = '000002';
    const retry = await store.create(other, () => Promise.resolve(snapshot));
    expect(retry.pin).toBe('000002');
    expect(store.findByPin(first.pin)).toEqual(first);
  });

  it('lets a queued retry succeed after the original lookup fails', async () => {
    const store = new InMemoryRoomStore();
    let reject!: (error: Error) => void;
    const first = store.create(
      input,
      () =>
        new Promise<QuizSnapshot>((_resolve, fail) => {
          reject = fail;
        }),
    );
    const retry = store.create(input, () => Promise.resolve(snapshot));
    const outcomes = Promise.allSettled([first, retry]);
    reject(new Error('Lookup failed'));
    expect((await outcomes).map((outcome) => outcome.status)).toEqual([
      'rejected',
      'fulfilled',
    ]);
  });

  it('releases an owner after the snapshot lookup fails', async () => {
    const store = new InMemoryRoomStore();
    await expect(
      store.create(input, () => Promise.reject(new Error('Unavailable'))),
    ).rejects.toThrow('Unavailable');
    expect(
      await store.create(input, () => Promise.resolve(snapshot)),
    ).toMatchObject({ host: { ownerId: input.ownerId } });
  });

  it('lets a different owner create while another owner lookup is pending', async () => {
    const store = new InMemoryRoomStore();
    let resolve!: (quiz: QuizSnapshot) => void;
    const pending = store.create(
      input,
      () =>
        new Promise<QuizSnapshot>((done) => {
          resolve = done;
        }),
    );
    try {
      expect(
        await store.create({ ...input, ownerId: 'other' }, () =>
          Promise.resolve(snapshot),
        ),
      ).toMatchObject({ host: { ownerId: 'other' } });
    } finally {
      resolve(snapshot);
      await pending;
    }
  });

  it('copies nested snapshot data so later source mutation cannot change it', async () => {
    const store = new InMemoryRoomStore();
    const source = {
      version: 1 as const,
      sourceQuizId: 'quiz',
      title: 'Original',
      questions: [
        {
          id: 'question',
          type: 'multiple-choice' as const,
          prompt: 'Original?',
          options: [{ id: 'a', text: 'Original' }],
          correctOptionIds: ['a'],
          durationSeconds: 20,
        },
      ],
    };
    const room = await store.create(input, () => Promise.resolve(source));
    source.questions[0].options[0].text = 'Changed';
    source.questions[0].correctOptionIds[0] = 'b';
    source.questions.reverse();
    expect(room.quiz.questions[0]).toMatchObject({
      options: [{ id: 'a', text: 'Original' }],
      correctOptionIds: ['a'],
    });
  });
});
