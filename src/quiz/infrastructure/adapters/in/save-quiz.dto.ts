import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class QuizOptionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  text!: string;
}

export class QuizQuestionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ enum: ['multiple-choice'] })
  @IsIn(['multiple-choice'])
  type!: 'multiple-choice';

  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  prompt!: string;

  @ApiProperty({ type: [QuizOptionDto], maxItems: 4 })
  @IsArray()
  @ArrayMaxSize(4)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  options!: QuizOptionDto[];

  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'uuid' },
    maxItems: 4,
  })
  @IsArray()
  @ArrayMaxSize(4)
  @IsUUID('all', { each: true })
  correctOptionIds!: string[];

  @ApiProperty({
    type: 'integer',
    nullable: true,
    minimum: 0,
    maximum: 3600,
    description: 'Null for unset; hostable values: 10, 20, 30, 60.',
  })
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(3600)
  durationSeconds!: number | null;
}

export class SaveQuizDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    type: [QuizQuestionDto],
    maxItems: 20,
    description:
      'Full replacement; array order is question order. Reuse stable client-generated UUIDs on edits.',
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  questions!: QuizQuestionDto[];
}
