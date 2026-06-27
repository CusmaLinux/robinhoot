import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LogoutInput {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

export interface LogoutOutput {
  success: boolean;
}

export const LOGOUT_USE_CASE_PORT = Symbol('LOGOUT_USE_CASE_PORT');
export interface LogoutUseCasePort {
  execute(input: LogoutInput): Promise<LogoutOutput>;
}
