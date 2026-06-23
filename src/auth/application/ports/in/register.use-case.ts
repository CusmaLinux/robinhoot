import { ApiProperty } from '@nestjs/swagger';

export class RegisterInput {
  @ApiProperty()
  email: string;

  @ApiProperty()
  password: string;
}

export interface RegisterOutput {
  id: string;
  email: string;
}

export const REGISTER_USE_CASE_PORT = Symbol('REGISTER_USE_CASE_PORT');
export interface RegisterUseCasePort {
  execute(input: RegisterInput): Promise<RegisterOutput>;
}
