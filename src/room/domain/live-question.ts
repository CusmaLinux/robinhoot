import type { GameReport } from './game-report';
export interface AnswerReceipt {
  readonly roomId: string;
  readonly questionId: string;
  readonly submissionId: string;
  readonly optionId: string;
  readonly accepted: true;
  readonly acceptedAt: number;
  readonly revision: number;
}
export interface AcceptedAnswer {
  readonly playerId: string;
  readonly receipt: AnswerReceipt;
}

export interface LiveRound {
  readonly scores: readonly {
    readonly playerId: string;
    readonly points: number;
  }[];
  readonly answers: readonly AcceptedAnswer[];
  readonly commandId: string;
  readonly expectedRevision: number;
  readonly questionIndex: number;
  readonly eligiblePlayerIds: readonly string[];
  readonly openedAt: number;
  readonly deadline: number;
  readonly monotonicDeadline: number;
}

export interface QuestionState {
  roomId: string;
  questionId: string;
  revision: number;
  phase: 'question_open' | 'question_reveal' | 'finished';
  finalizing?: boolean;
  report?: GameReport;
  question: {
    id: string;
    type: 'multiple-choice';
    prompt: string;
    options: { id: string; label: string; text: string }[];
  };
  eligiblePlayerIds: string[];
  openedAt: number;
  deadline: number;
  serverNow: number;
  timeUnit: 'milliseconds';
  correctOptionIds?: string[];
  score: number;
  acceptedAnswer?: AnswerReceipt | null;
}
