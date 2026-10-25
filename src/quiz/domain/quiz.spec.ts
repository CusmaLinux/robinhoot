import { quizReadiness, type Quiz, type QuizQuestion } from './quiz';

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
