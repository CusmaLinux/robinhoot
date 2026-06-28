import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterInput {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export interface RegisterOutput {
  id: string;
  email: string;
}

export const REGISTER_USE_CASE_PORT = Symbol('REGISTER_USE_CASE_PORT');
export interface RegisterUseCasePort {
  execute(input: RegisterInput): Promise<RegisterOutput>;
}
