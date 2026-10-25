export const CREATE_ROOM_EXAMPLE = {
  quizId: 'd65ae15c-a1d9-42ce-a328-104d2eebd8f1',
  requestId: 'a9befeed-6bee-4bde-83c8-0e73961e223d',
};

export const ROOM_CREATED_EXAMPLE = {
  roomId: '52783943-0601-4716-8d62-46c6c890047a',
  pin: '004218',
  phase: 'lobby',
  revision: 0,
  createdAt: '2026-10-25T16:00:00.000Z',
};

export const ROOM_NOT_HOSTABLE_EXAMPLE = {
  statusCode: 400,
  code: 'QUIZ_NOT_HOSTABLE',
  message: 'Quiz is not hostable',
  fields: [
    { field: 'title', code: 'REQUIRED', message: 'Title is required' },
    {
      field: 'questions',
      code: 'QUESTION_COUNT',
      message: 'Quiz must contain 1–20 questions',
    },
  ],
};

export const ROOM_NOT_FOUND_EXAMPLE = {
  statusCode: 404,
  code: 'QUIZ_NOT_FOUND',
  message: 'Quiz not found',
};
export const ROOM_ACTIVE_EXAMPLE = {
  statusCode: 409,
  code: 'OWNER_HAS_ACTIVE_ROOM',
  message: 'Owner already has an active room',
};
export const ROOM_REQUEST_CONFLICT_EXAMPLE = {
  statusCode: 409,
  code: 'CREATION_REQUEST_CONFLICT',
  message: 'Request ID was already used for another quiz',
};
export const ROOM_PIN_EXHAUSTED_EXAMPLE = {
  statusCode: 503,
  code: 'PIN_ALLOCATION_EXHAUSTED',
  message: 'Unable to allocate a room PIN; retry this request',
};
