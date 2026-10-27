import type { Room } from './room';

export function completedRoom(): Room {
  const ids = ['zoe', 'alice', 'bob', 'missing'];
  const question = {
    id: 'q',
    type: 'multiple-choice' as const,
    prompt: 'Original?',
    options: [
      { id: 'yes', text: 'Yes' },
      { id: 'no', text: 'No' },
    ],
    correctOptionIds: ['yes'],
    durationSeconds: 20,
  };
  return {
    roomId: 'room',
    pin: '123456',
    phase: 'question_reveal',
    revision: 5,
    createdAt: '2026-10-27T00:00:00.000Z',
    host: { ownerId: 'owner' },
    creationRequestId: 'create',
    quiz: {
      version: 1,
      sourceQuizId: 'quiz',
      title: 'Original',
      questions: [question],
    },
    guests: ids.map((playerId) => ({
      playerId,
      nickname: playerId,
      connectionId: null,
      credentialVerifier: 'PRIVATE',
      admission: {
        requestId: 'join',
        connectionId: 'old',
        credential: 'SECRET',
      },
    })),
    round: {
      commandId: 'start',
      expectedRevision: 4,
      questionIndex: 0,
      eligiblePlayerIds: ids,
      openedAt: 0,
      deadline: 20_000,
      monotonicDeadline: 20_000,
      scores: ids.map((playerId, i) => ({
        playerId,
        points: i < 2 ? 1000 : 0,
      })),
      answers: ids.slice(0, 3).map((playerId, i) => ({
        playerId,
        receipt: {
          roomId: 'room',
          questionId: 'q',
          submissionId: playerId,
          optionId: i < 2 ? 'yes' : 'no',
          accepted: true,
          acceptedAt: 1,
          revision: i + 1,
        },
      })),
    },
  };
}
