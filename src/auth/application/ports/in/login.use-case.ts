export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginOutput {
  accessToken: string;
}

export const LOGIN_USE_CASE_PORT = Symbol('LOGIN_USE_CASE_PORT');
export interface LoginUseCasePort {
  execute(input: LoginInput): Promise<LoginOutput>;
}
