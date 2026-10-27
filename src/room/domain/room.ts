import type { LiveRound } from './live-question';
import type { Guest } from './lobby';
export interface QuizSnapshot {
  readonly version: 1;
  readonly sourceQuizId: string;
  readonly title: string;
  readonly questions: readonly {
    readonly id: string;
    readonly type: 'multiple-choice';
    readonly prompt: string;
    readonly options: readonly { readonly id: string; readonly text: string }[];
    readonly correctOptionIds: readonly string[];
    readonly durationSeconds: number;
  }[];
}

export interface RoomMetadata {
  readonly roomId: string;
  readonly pin: string;
  readonly phase: 'lobby' | 'closed' | 'question_open' | 'question_reveal';
  readonly revision: number;
  readonly createdAt: string;
}

export interface Room extends RoomMetadata {
  readonly round?: LiveRound;
  readonly previousRounds?: readonly LiveRound[];
  readonly guests: readonly Guest[];
  readonly host: { readonly ownerId: string };
  readonly creationRequestId: string;
  readonly quiz: QuizSnapshot;
}

export function freezeSnapshot(quiz: QuizSnapshot): QuizSnapshot {
  return Object.freeze({
    version: quiz.version,
    sourceQuizId: quiz.sourceQuizId,
    title: quiz.title,
    questions: Object.freeze(
      quiz.questions.map((question) =>
        Object.freeze({
          ...question,
          options: Object.freeze(
            question.options.map((option) => Object.freeze({ ...option })),
          ),
          correctOptionIds: Object.freeze([...question.correctOptionIds]),
        }),
      ),
    ),
  });
}

export function roomMetadata(room: Room): RoomMetadata {
  return {
    roomId: room.roomId,
    pin: room.pin,
    phase: room.phase,
    revision: room.revision,
    createdAt: room.createdAt,
  };
}
