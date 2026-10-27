import { ApiProperty } from '@nestjs/swagger';
import type { GameReport } from '../../../domain/game-report';

class ReportOptionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  text!: string;
}
class ReportQuestionSnapshotDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ enum: ['multiple-choice'] })
  type!: 'multiple-choice';
  @ApiProperty()
  prompt!: string;
  @ApiProperty({ type: [ReportOptionDto] })
  options!: ReportOptionDto[];
  @ApiProperty({ type: [String], format: 'uuid' })
  correctOptionIds!: string[];
  @ApiProperty({ enum: [10, 20, 30, 60] })
  durationSeconds!: number;
}
class ReportQuizSnapshotDto {
  @ApiProperty({ enum: [1] })
  version!: 1;
  @ApiProperty({
    format: 'uuid',
    description: 'Informational source ID; source may have been deleted.',
  })
  sourceQuizId!: string;
  @ApiProperty()
  title!: string;
  @ApiProperty({
    type: [ReportQuestionSnapshotDto],
    description: 'Immutable original snapshot order.',
  })
  questions!: ReportQuestionSnapshotDto[];
}
class ReportStandingDto {
  @ApiProperty({ format: 'uuid' })
  playerId!: string;
  @ApiProperty()
  nickname!: string;
  @ApiProperty({ minimum: 0, example: 2000 })
  total!: number;
  @ApiProperty({
    minimum: 1,
    example: 1,
    description: 'Competition rank: totals 2000/2000/1000 receive ranks 1/1/3.',
  })
  rank!: number;
}
class ReportDifficultyDto {
  @ApiProperty({ format: 'uuid' })
  questionId!: string;
  @ApiProperty({ minimum: 1, example: 4 })
  eligible!: number;
  @ApiProperty({ minimum: 0, example: 1 })
  correct!: number;
  @ApiProperty({ minimum: 0, example: 1 })
  incorrect!: number;
  @ApiProperty({ minimum: 0, example: 2 })
  missing!: number;
  @ApiProperty({
    minimum: 0,
    maximum: 100,
    example: 25,
    description:
      'Unrounded percentage: correct / eligible * 100. Lower means harder; equal values tie.',
  })
  accuracy!: number;
}
export class GameReportDto implements GameReport {
  @ApiProperty({ enum: [1] })
  version!: 1;
  @ApiProperty({ format: 'uuid', description: 'Report ID equals room ID.' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  roomId!: string;
  @ApiProperty({ format: 'uuid' })
  ownerId!: string;
  @ApiProperty({ format: 'date-time' })
  completedAt!: string;
  @ApiProperty({ type: ReportQuizSnapshotDto })
  quiz!: ReportQuizSnapshotDto;
  @ApiProperty({
    type: [ReportStandingDto],
    description:
      'Descending total, then NFKC/lowercase nickname, then player ID; sorting never breaks rank ties.',
  })
  standings!: ReportStandingDto[];
  @ApiProperty({
    type: [ReportDifficultyDto],
    description:
      'Snapshot order, including disconnected players in every denominator.',
  })
  questions!: ReportDifficultyDto[];
}
