import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginInput {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;
}

export interface LoginOutput {
  accessToken: string;
}

export const LOGIN_USE_CASE_PORT = Symbol('LOGIN_USE_CASE_PORT');
export interface LoginUseCasePort {
  execute(input: LoginInput): Promise<LoginOutput>;
}
