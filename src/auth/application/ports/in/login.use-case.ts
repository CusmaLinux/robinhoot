import { ApiProperty } from '@nestjs/swagger';

export class LoginInput {
  @ApiProperty()
  email: string;

  @ApiProperty()
  password: string;
}

export interface LoginOutput {
  accessToken: string;
}

export const LOGIN_USE_CASE_PORT = Symbol('LOGIN_USE_CASE_PORT');
export interface LoginUseCasePort {
  execute(input: LoginInput): Promise<LoginOutput>;
}
