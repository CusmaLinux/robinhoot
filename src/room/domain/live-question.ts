export interface LiveRound {
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
  phase: 'question_open' | 'question_reveal';
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
}
