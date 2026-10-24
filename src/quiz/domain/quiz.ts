export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple-choice';
  prompt: string;
  options: QuizOption[];
  correctOptionIds: string[];
  durationSeconds: number | null;
}

export interface QuizContent {
  title: string;
  questions: QuizQuestion[];
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
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
  if (quiz.questions.length === 0 || quiz.questions.length > 20)
    errors.push({
      field: 'questions',
      code: 'QUESTION_COUNT',
      message: 'Quiz must contain 1–20 questions',
    });
  quiz.questions.forEach((question, index) => {
    const field = `questions[${index}]`;
    if (!question.prompt.trim())
      errors.push({
        field: `${field}.prompt`,
        code: 'REQUIRED',
        message: 'Prompt is required',
      });
    if (question.options.length !== 4)
      errors.push({
        field: `${field}.options`,
        code: 'OPTION_COUNT',
        message: 'Question must contain four options',
      });
    question.options.forEach((option, optionIndex) => {
      if (!option.text.trim())
        errors.push({
          field: `${field}.options[${optionIndex}].text`,
          code: 'REQUIRED',
          message: 'Option text is required',
        });
    });
    if (question.correctOptionIds.length !== 1)
      errors.push({
        field: `${field}.correctOptionIds`,
        code: 'CORRECT_OPTION_COUNT',
        message: 'Question must have exactly one correct option',
      });
    if (
      question.durationSeconds === null ||
      ![10, 20, 30, 60].includes(question.durationSeconds)
    )
      errors.push({
        field: `${field}.durationSeconds`,
        code: 'DURATION',
        message: 'Duration must be 10, 20, 30, or 60 seconds',
      });
  });
  return { hostable: errors.length === 0, errors };
}

export class InvalidQuizStructureError extends Error {}

export function assertQuizStructure(content: QuizContent): void {
  const questionIds = content.questions.map((question) =>
    question.id.toLowerCase(),
  );
  if (new Set(questionIds).size !== questionIds.length) {
    throw new InvalidQuizStructureError('questions: duplicate question IDs');
  }
  content.questions.forEach((question, index) => {
    const optionIds = question.options.map((option) => option.id.toLowerCase());
    if (new Set(optionIds).size !== optionIds.length) {
      throw new InvalidQuizStructureError(
        `questions[${index}].options: duplicate option IDs`,
      );
    }
    const correctIds = question.correctOptionIds.map((id) => id.toLowerCase());
    if (new Set(correctIds).size !== correctIds.length) {
      throw new InvalidQuizStructureError(
        `questions[${index}].correctOptionIds: duplicate correct-option IDs`,
      );
    }
    if (
      question.correctOptionIds.some(
        (id) => !optionIds.includes(id.toLowerCase()),
      )
    ) {
      throw new InvalidQuizStructureError(
        `questions[${index}].correctOptionIds: must reference options in this question`,
      );
    }
  });
}
