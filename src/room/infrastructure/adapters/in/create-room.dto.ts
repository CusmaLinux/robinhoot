import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  quizId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Reuse this UUID when retrying this creation request.',
  })
  @IsUUID()
  requestId!: string;
}
