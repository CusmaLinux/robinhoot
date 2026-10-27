import { freezeSnapshot, type QuizSnapshot, type Room } from './room';

export interface GameReport {
  readonly version: 1 | 2;
  readonly id: string;
  readonly roomId: string;
  readonly ownerId: string;
  readonly completedAt: string;
  readonly quiz: QuizSnapshot;
  readonly standings: readonly {
    readonly playerId: string;
    readonly nickname: string;
    readonly total: number;
    readonly rank: number;
  }[];
  readonly questions: readonly {
    readonly questionId: string;
    readonly eligible: number;
    readonly correct: number;
    readonly incorrect: number;
    readonly missing: number;
    readonly accuracy: number;
  }[];
}

export function freezeGameReport(report: GameReport): GameReport {
  return Object.freeze({
    ...report,
    quiz: freezeSnapshot(report.quiz),
    standings: Object.freeze(
      report.standings.map((standing) => Object.freeze({ ...standing })),
    ),
    questions: Object.freeze(
      report.questions.map((question) => Object.freeze({ ...question })),
    ),
  });
}

export function buildGameReport(room: Room, completedAt: string): GameReport {
  const rounds = [...(room.previousRounds ?? []), room.round!];
  const eligibleIds = rounds[0].eligiblePlayerIds;
  const totals = eligibleIds.map((playerId) => ({
    playerId,
    nickname: room.guests.find((guest) => guest.playerId === playerId)!
      .nickname,
    total: rounds.reduce(
      (total, round) =>
        total +
        (round.scores.find((score) => score.playerId === playerId)?.points ??
          0),
      0,
    ),
  }));
  const key = (nickname: string) => nickname.normalize('NFKC').toLowerCase();
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  totals.sort(
    (a, b) =>
      b.total - a.total ||
      compare(key(a.nickname), key(b.nickname)) ||
      compare(a.playerId, b.playerId),
  );
  return Object.freeze({
    version: room.quiz.version,
    id: room.roomId,
    roomId: room.roomId,
    ownerId: room.host.ownerId,
    completedAt,
    quiz: freezeSnapshot(room.quiz),
    standings: Object.freeze(
      totals.map((player, index) =>
        Object.freeze({
          ...player,
          rank:
            totals.findIndex((other) => other.total === totals[index].total) +
            1,
        }),
      ),
    ),
    questions: Object.freeze(
      room.quiz.questions.map((question, index) => {
        const answers = rounds[index].answers.filter((answer) =>
          eligibleIds.includes(answer.playerId),
        );
        const correct = answers.filter((answer) =>
          question.correctOptionIds.includes(answer.receipt.optionId),
        ).length;
        return Object.freeze({
          questionId: question.id,
          eligible: eligibleIds.length,
          correct,
          incorrect: answers.length - correct,
          missing: eligibleIds.length - answers.length,
          accuracy: (correct / eligibleIds.length) * 100,
        });
      }),
    ),
  });
}
