import { ApiProperty } from '@nestjs/swagger';
import { QuizQuestionDto } from './save-quiz.dto';

class ReadinessErrorDto {
  @ApiProperty({ example: 'title' })
  field!: string;

  @ApiProperty({
    enum: [
      'REQUIRED',
      'QUESTION_COUNT',
      'OPTION_COUNT',
      'CORRECT_OPTION_COUNT',
      'DURATION',
      'OPTION_MAPPING',
      'CORRECT_OPTION_MAPPING',
    ],
  })
  code!: string;

  @ApiProperty({ example: 'Title is required' })
  message!: string;
}

export class QuizSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ maxLength: 200 })
  title!: string;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time', type: String })
  updatedAt!: Date;

  @ApiProperty()
  hostable!: boolean;

  @ApiProperty({ minimum: 0 })
  questionCount!: number;
}

export class QuizDetailDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ maxLength: 200 })
  title!: string;

  @ApiProperty({
    type: [QuizQuestionDto],
    maxItems: 20,
    description: 'Saved questions in explicit array order.',
  })
  questions!: QuizQuestionDto[];

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time', type: String })
  updatedAt!: Date;

  @ApiProperty()
  hostable!: boolean;

  @ApiProperty({ type: [ReadinessErrorDto] })
  errors!: ReadinessErrorDto[];
}
