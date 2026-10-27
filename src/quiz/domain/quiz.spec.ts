import {
  TRUE_FALSE_OPTIONS,
  assertQuizStructure,
  quizReadiness,
  type Quiz,
  type QuizQuestion,
} from './quiz';

function completeQuestion(): QuizQuestion {
  return {
    id: 'question',
    type: 'multiple-choice',
    prompt: 'Question?',
    options: ['a', 'b', 'c', 'd'].map((id) => ({ id, text: id })),
    correctOptionIds: ['a'],
    durationSeconds: 20,
  };
}
function quiz(questions = [completeQuestion()]): Quiz {
  return {
    id: 'quiz',
    title: 'Biology',
    questions,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('Quiz readiness', () => {
  it('prevents hosting or saving a persisted credential-bearing image reference', () => {
    const content = quiz([
      {
        ...completeQuestion(),
        imageUrl: 'https://teacher:password@images.example/cell.png',
      },
    ]);
    expect(quizReadiness(content)).toMatchObject({
      hostable: false,
      errors: [{ field: 'questions[0].imageUrl', code: 'IMAGE_URL' }],
    });
    expect(() => assertQuizStructure(content)).toThrow('questions[0].imageUrl');
  });
  it('keeps legacy multiple-choice UUIDs valid even when they match new truth IDs', () => {
    const original = quiz([
      {
        ...completeQuestion(),
        options: [
          ...TRUE_FALSE_OPTIONS,
          ...completeQuestion().options.slice(2),
        ],
        correctOptionIds: [TRUE_FALSE_OPTIONS[0].id],
      },
    ]);
    expect(quizReadiness(original)).toEqual({ hostable: true, errors: [] });
    expect(() => assertQuizStructure(original)).not.toThrow();
  });
  it.each([
    { prompt: ' ', code: 'REQUIRED' },
    { correctOptionIds: [], code: 'CORRECT_OPTION_COUNT' },
    {
      correctOptionIds: TRUE_FALSE_OPTIONS.map((option) => option.id),
      code: 'CORRECT_OPTION_COUNT',
    },
    { durationSeconds: null, code: 'DURATION' },
    { durationSeconds: 15, code: 'DURATION' },
  ])(
    'keeps an incomplete truth question unhostable: $code',
    ({ code, ...changes }) => {
      const truth: QuizQuestion = {
        ...completeQuestion(),
        type: 'true-false',
        options: [...TRUE_FALSE_OPTIONS],
        correctOptionIds: [TRUE_FALSE_OPTIONS[0].id],
        ...changes,
      };
      expect(quizReadiness(quiz([truth]))).toMatchObject({
        hostable: false,
        errors: [expect.objectContaining({ code })],
      });
    },
  );
  it.each([10, 20, 30, 60])(
    'accepts truth questions at %i seconds',
    (durationSeconds) => {
      const truth: QuizQuestion = {
        ...completeQuestion(),
        type: 'true-false',
        options: [...TRUE_FALSE_OPTIONS],
        correctOptionIds: [TRUE_FALSE_OPTIONS[1].id],
        durationSeconds,
      };
      expect(quizReadiness(quiz([truth]))).toEqual({
        hostable: true,
        errors: [],
      });
    },
  );
  it.each([
    [],
    [...TRUE_FALSE_OPTIONS].reverse(),
    [{ ...TRUE_FALSE_OPTIONS[0], text: 'Yes' }, TRUE_FALSE_OPTIONS[1]],
    [{ ...TRUE_FALSE_OPTIONS[0], id: 'stale' }, TRUE_FALSE_OPTIONS[1]],
    [TRUE_FALSE_OPTIONS[0], TRUE_FALSE_OPTIONS[0]],
  ])('rejects invalid fixed truth choices %#', (...options) => {
    // Jest expands array rows into arguments.
    const truth: QuizQuestion = {
      ...completeQuestion(),
      type: 'true-false',
      options,
      correctOptionIds: [],
    };
    expect(() => assertQuizStructure(quiz([truth]))).toThrow();
    expect(quizReadiness(quiz([truth])).hostable).toBe(false);
  });
  it('cannot host a persisted truth question whose correct ID is not a choice', () => {
    const truth: QuizQuestion = {
      ...completeQuestion(),
      type: 'true-false',
      options: [...TRUE_FALSE_OPTIONS],
      correctOptionIds: ['stale-id'],
    };
    expect(quizReadiness(quiz([truth]))).toMatchObject({
      hostable: false,
      errors: [
        {
          field: 'questions[0].correctOptionIds',
          code: 'CORRECT_OPTION_MAPPING',
        },
      ],
    });
  });
  it.each(['question', 'QUESTION'])(
    'rejects stale truth choices on conversion for question ID %s',
    (id) => {
      const content = quiz([
        {
          ...completeQuestion(),
          id,
          correctOptionIds: [TRUE_FALSE_OPTIONS[0].id],
          options: [
            ...TRUE_FALSE_OPTIONS,
            ...completeQuestion().options.slice(2),
          ],
        },
      ]);
      expect(() =>
        assertQuizStructure(
          content,
          quiz([
            {
              ...completeQuestion(),
              type: 'true-false',
              options: [...TRUE_FALSE_OPTIONS],
              correctOptionIds: [TRUE_FALSE_OPTIONS[0].id],
            },
          ]),
        ),
      ).toThrow('stale');
    },
  );
  it('rejects stale multiple-choice mappings on conversion to True/False', () => {
    const content = quiz([{ ...completeQuestion(), type: 'true-false' }]);
    expect(() => assertQuizStructure(content)).toThrow('fixed True/False');
  });
  it('accepts a True/False question with fixed choices', () => {
    expect(
      quizReadiness(
        quiz([
          {
            ...completeQuestion(),
            type: 'true-false',
            options: [
              { id: '00000000-0000-4000-8000-000000000001', text: 'True' },
              { id: '00000000-0000-4000-8000-000000000002', text: 'False' },
            ],
            correctOptionIds: ['00000000-0000-4000-8000-000000000001'],
          },
        ]),
      ),
    ).toEqual({ hostable: true, errors: [] });
  });
  it.each([10, 20, 30, 60])(
    'accepts the supported %i-second duration',
    (durationSeconds) => {
      expect(
        quizReadiness(quiz([{ ...completeQuestion(), durationSeconds }])),
      ).toEqual({ hostable: true, errors: [] });
    },
  );
  it.each([0, 21])('reports %i questions as not hostable', (count) => {
    expect(
      quizReadiness(quiz(Array.from({ length: count }, completeQuestion))),
    ).toMatchObject({
      hostable: false,
      errors: [{ field: 'questions', code: 'QUESTION_COUNT' }],
    });
  });
  it('accepts the twenty-question boundary', () => {
    expect(
      quizReadiness(quiz(Array.from({ length: 20 }, completeQuestion))),
    ).toEqual({ hostable: true, errors: [] });
  });
  it.each([{ correctOptionIds: [] }, { correctOptionIds: ['a', 'b'] }])(
    'reports an invalid correct-option count $correctOptionIds',
    ({ correctOptionIds }) => {
      expect(
        quizReadiness(quiz([{ ...completeQuestion(), correctOptionIds }])),
      ).toMatchObject({
        hostable: false,
        errors: [
          {
            field: 'questions[0].correctOptionIds',
            code: 'CORRECT_OPTION_COUNT',
          },
        ],
      });
    },
  );
  it.each([null, 0, 15, 3600])(
    'reports unsupported duration %s',
    (durationSeconds) => {
      expect(
        quizReadiness(quiz([{ ...completeQuestion(), durationSeconds }])),
      ).toMatchObject({
        hostable: false,
        errors: [{ field: 'questions[0].durationSeconds', code: 'DURATION' }],
      });
    },
  );
  it('identifies a blank option in the second question by its array position', () => {
    const second = completeQuestion();
    second.options[2].text = '  ';
    expect(quizReadiness(quiz([completeQuestion(), second]))).toEqual({
      hostable: false,
      errors: [
        {
          field: 'questions[1].options[2].text',
          code: 'REQUIRED',
          message: 'Option text is required',
        },
      ],
    });
  });
  it('reports fewer than four options', () => {
    const q = completeQuestion();
    q.options.pop();
    expect(quizReadiness(quiz([q]))).toMatchObject({
      hostable: false,
      errors: [{ field: 'questions[0].options', code: 'OPTION_COUNT' }],
    });
  });
});
