import { buildGameReport } from './game-report';
import { completedRoom } from './game-report.fixture';

describe('Game report facts', () => {
  it('ranks equal totals 1,1,3 in stable nickname order including disconnected players', () => {
    const report = buildGameReport(completedRoom(), '2026-10-27T01:00:00.000Z');
    expect(
      report.standings.map(({ nickname, rank, total }) => ({
        nickname,
        rank,
        total,
      })),
    ).toEqual([
      { nickname: 'alice', rank: 1, total: 1000 },
      { nickname: 'zoe', rank: 1, total: 1000 },
      { nickname: 'bob', rank: 3, total: 0 },
      { nickname: 'missing', rank: 3, total: 0 },
    ]);
  });
  it('preserves question facts and frozen eligibility without storing session secrets', () => {
    const room = completedRoom();
    const report = buildGameReport(room, '2026-10-27T01:00:00.000Z');
    expect(report.questions).toEqual([
      {
        questionId: 'q',
        eligible: 4,
        correct: 2,
        incorrect: 1,
        missing: 1,
        accuracy: 50,
      },
    ]);
    expect(report.quiz).toEqual(room.quiz);
    expect(report.quiz).not.toBe(room.quiz);
    expect(JSON.stringify(report)).not.toMatch(
      /SECRET|PRIVATE|credential|connectionId/,
    );
    expect(buildGameReport(room, report.completedAt)).toEqual(report);
    expect(Object.isFrozen(report.quiz.questions[0].options)).toBe(true);
  });
  it('reports 25 percent accuracy for one correct, one wrong and two missing answers', () => {
    const room = completedRoom();
    const report = buildGameReport(
      {
        ...room,
        round: {
          ...room.round!,
          answers: [room.round!.answers[0], room.round!.answers[2]],
          scores: room.round!.scores.map((score, i) => ({
            ...score,
            points: i === 0 ? 1000 : 0,
          })),
        },
      },
      '2026-10-27T01:00:00.000Z',
    );
    expect(report.questions).toEqual([
      {
        questionId: 'q',
        eligible: 4,
        correct: 1,
        incorrect: 1,
        missing: 2,
        accuracy: 25,
      },
    ]);
  });
});
