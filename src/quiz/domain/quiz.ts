import { isQuestionImageUrl } from './question-image';

export interface QuizOption {
  id: string;
  text: string;
}

export const TRUE_FALSE_OPTIONS: readonly Readonly<QuizOption>[] =
  Object.freeze([
    Object.freeze({ id: '00000000-0000-4000-8000-000000000001', text: 'True' }),
    Object.freeze({
      id: '00000000-0000-4000-8000-000000000002',
      text: 'False',
    }),
  ]);

function truthMappingError(question: QuizQuestion): string | undefined {
  if (question.type !== 'true-false') return;
  if (
    question.options.length !== 2 ||
    question.options.some(
      (option, index) =>
        option.id !== TRUE_FALSE_OPTIONS[index].id ||
        option.text !== TRUE_FALSE_OPTIONS[index].text,
    )
  )
    return 'must contain the fixed True/False choices in order';
}

export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false';
  prompt: string;
  imageUrl?: string;
  imageDescription?: string;
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

function questionImageErrors(
  question: QuizQuestion,
  field: string,
): ReadinessError[] {
  const errors: ReadinessError[] = [];
  if (question.imageUrl !== undefined && !isQuestionImageUrl(question.imageUrl))
    errors.push({
      field: `${field}.imageUrl`,
      code: 'IMAGE_URL',
      message:
        'Must be an HTTPS URL of at most 2048 characters without credentials',
    });
  if (
    question.imageDescription !== undefined &&
    (typeof question.imageDescription !== 'string' ||
      [...question.imageDescription].length > 500)
  )
    errors.push({
      field: `${field}.imageDescription`,
      code: 'IMAGE_DESCRIPTION',
      message: 'Must be a string of at most 500 characters',
    });
  return errors;
}

function questionMappingReadiness(
  question: QuizQuestion,
  field: string,
): ReadinessError[] {
  const errors: ReadinessError[] = [];
  const mappingError = truthMappingError(question);
  if (mappingError)
    errors.push({
      field: `${field}.options`,
      code: 'OPTION_MAPPING',
      message: mappingError,
    });
  if (
    question.correctOptionIds.some(
      (id) => !question.options.some((option) => option.id === id),
    )
  )
    errors.push({
      field: `${field}.correctOptionIds`,
      code: 'CORRECT_OPTION_MAPPING',
      message: 'Correct IDs must reference choices in this question',
    });
  return errors;
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
    errors.push(...questionImageErrors(question, field));
    errors.push(...questionMappingReadiness(question, field));
    if (!question.prompt.trim())
      errors.push({
        field: `${field}.prompt`,
        code: 'REQUIRED',
        message: 'Prompt is required',
      });
    const optionCount = question.type === 'true-false' ? 2 : 4;
    if (question.options.length !== optionCount)
      errors.push({
        field: `${field}.options`,
        code: 'OPTION_COUNT',
        message: `Question must contain ${optionCount === 2 ? 'two' : 'four'} options`,
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

export function assertQuizStructure(
  content: QuizContent,
  previous?: QuizContent,
): void {
  const questionIds = content.questions.map((question) =>
    question.id.toLowerCase(),
  );
  if (new Set(questionIds).size !== questionIds.length) {
    throw new InvalidQuizStructureError('questions: duplicate question IDs');
  }
  content.questions.forEach((question, index) => {
    const imageError = questionImageErrors(question, `questions[${index}]`)[0];
    if (imageError)
      throw new InvalidQuizStructureError(
        `${imageError.field}: ${imageError.message}`,
      );
    const oldQuestion = previous?.questions.find(
      (old) => old.id.toLowerCase() === question.id.toLowerCase(),
    );
    if (
      oldQuestion &&
      oldQuestion.type !== question.type &&
      question.options.some((option) =>
        oldQuestion.options.some(
          (old) => old.id.toLowerCase() === option.id.toLowerCase(),
        ),
      )
    )
      throw new InvalidQuizStructureError(
        `questions[${index}].options: type conversion requires new choice IDs; stale mappings cannot be retained`,
      );
    const mappingError = truthMappingError(question);
    if (mappingError)
      throw new InvalidQuizStructureError(
        `questions[${index}].options: ${mappingError}`,
      );
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
