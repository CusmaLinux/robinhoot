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
