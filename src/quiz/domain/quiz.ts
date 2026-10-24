export interface Quiz {
  id: string;
  title: string;
  questions: never[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReadinessError {
  field: string;
  code: string;
  message: string;
}

export function quizReadiness(quiz: Quiz): {
  hostable: boolean;
  errors: ReadinessError[];
} {
  const errors: ReadinessError[] = [];
  if (!quiz.title.trim())
    errors.push({
      field: 'title',
      code: 'REQUIRED',
      message: 'Title is required',
    });
  if (quiz.questions.length === 0)
    errors.push({
      field: 'questions',
      code: 'QUESTION_COUNT',
      message: 'Quiz must contain 1–20 questions',
    });
  return { hostable: errors.length === 0, errors };
}
