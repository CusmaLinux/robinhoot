import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, ValidateIf } from 'class-validator';

export class CreateQuizDto {
  @ApiPropertyOptional({ default: '', maxLength: 200 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(200)
  title?: string;
}
