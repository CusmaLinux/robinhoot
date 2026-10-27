import { ApiProperty } from '@nestjs/swagger';
import type { RoomMetadata } from '../../../domain/room';

export class RoomMetadataDto implements RoomMetadata {
  @ApiProperty({ format: 'uuid' })
  roomId!: string;

  @ApiProperty({ pattern: '^\\d{6}$', example: '004218' })
  pin!: string;

  @ApiProperty({
    enum: ['lobby', 'question_open', 'question_reveal', 'finished'],
  })
  phase!: RoomMetadata['phase'];

  @ApiProperty({ minimum: 0, example: 0 })
  revision!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
