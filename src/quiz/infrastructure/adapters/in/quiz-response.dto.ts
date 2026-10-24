import { ApiProperty } from '@nestjs/swagger';

export class ReadinessErrorDto {
  @ApiProperty({ example: 'title' })
  field!: string;

  @ApiProperty({ enum: ['REQUIRED', 'QUESTION_COUNT'] })
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
    type: 'array',
    items: {},
    maxItems: 0,
    description:
      'Empty at creation. Question editing is delivered separately in issue #48.',
  })
  questions!: never[];

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time', type: String })
  updatedAt!: Date;

  @ApiProperty()
  hostable!: boolean;

  @ApiProperty({ type: [ReadinessErrorDto] })
  errors!: ReadinessErrorDto[];
}
