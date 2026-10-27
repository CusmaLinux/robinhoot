import { TRUE_FALSE_OPTIONS } from '../../../domain/quiz';

export const EMPTY_DRAFT_EXAMPLE = {
  id: 'd65ae15c-a1d9-42ce-a328-104d2eebd8f1',
  title: '',
  questions: [],
  createdAt: '2026-10-24T00:00:00.000Z',
  updatedAt: '2026-10-24T00:00:00.000Z',
  hostable: false,
  errors: [
    { field: 'title', code: 'REQUIRED', message: 'Title is required' },
    {
      field: 'questions',
      code: 'QUESTION_COUNT',
      message: 'Quiz must contain 1–20 questions',
    },
  ],
};

export const QUIZ_LIST_EXAMPLE = [
  {
    id: EMPTY_DRAFT_EXAMPLE.id,
    title: '',
    questionCount: 0,
    createdAt: EMPTY_DRAFT_EXAMPLE.createdAt,
    updatedAt: EMPTY_DRAFT_EXAMPLE.updatedAt,
    hostable: false,
  },
];

export const QUIZ_UNAUTHORIZED_EXAMPLE = {
  statusCode: 401,
  message: 'Unauthorized',
  error: 'Unauthorized',
};
export const QUIZ_NOT_FOUND_EXAMPLE = {
  statusCode: 404,
  message: 'Quiz not found',
  error: 'Not Found',
};
export const QUIZ_BAD_REQUEST_EXAMPLE = {
  statusCode: 400,
  message: ['property ownerId should not exist'],
  error: 'Bad Request',
};
export const QUIZ_BAD_ID_EXAMPLE = {
  statusCode: 400,
  message: 'Validation failed (uuid is expected)',
  error: 'Bad Request',
};

export const SAVE_QUIZ_EXAMPLE = {
  title: 'Biology',
  questions: [
    {
      id: '10000000-0000-4000-8000-000000000001',
      type: 'multiple-choice',
      prompt: 'Which cell contains a nucleus?',
      options: [
        { id: '20000000-0000-4000-8000-000000000001', text: 'Animal' },
        { id: '20000000-0000-4000-8000-000000000002', text: 'Bacterium' },
        { id: '20000000-0000-4000-8000-000000000003', text: 'Virus' },
        { id: '20000000-0000-4000-8000-000000000004', text: 'None' },
      ],
      correctOptionIds: ['20000000-0000-4000-8000-000000000001'],
      durationSeconds: 20,
    },
  ],
};

export const MIXED_QUIZ_EXAMPLE = {
  title: 'Biology: mixed formats',
  questions: [
    ...SAVE_QUIZ_EXAMPLE.questions,
    {
      id: '10000000-0000-4000-8000-000000000002',
      type: 'true-false',
      prompt: 'All cells have a nucleus.',
      imageUrl: 'https://unreachable.invalid/cell.png',
      imageDescription: 'A labeled animal cell',
      options: TRUE_FALSE_OPTIONS,
      correctOptionIds: [TRUE_FALSE_OPTIONS[1].id],
      durationSeconds: 10,
    },
  ],
};

export const HOSTABLE_QUIZ_EXAMPLE = {
  ...EMPTY_DRAFT_EXAMPLE,
  ...SAVE_QUIZ_EXAMPLE,
  hostable: true,
  errors: [],
};

export const INCOMPLETE_SAVE_EXAMPLE = {
  ...SAVE_QUIZ_EXAMPLE,
  questions: [{ ...SAVE_QUIZ_EXAMPLE.questions[0], durationSeconds: 15 }],
};

export const INCOMPLETE_QUIZ_EXAMPLE = {
  ...EMPTY_DRAFT_EXAMPLE,
  ...INCOMPLETE_SAVE_EXAMPLE,
  errors: [
    {
      field: 'questions[0].durationSeconds',
      code: 'DURATION',
      message: 'Duration must be 10, 20, 30, or 60 seconds',
    },
  ],
};
