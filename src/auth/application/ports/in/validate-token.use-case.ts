export interface ValidatedToken {
  userId: string;
  email: string;
  roles: string[];
}

export const VALIDATE_TOKEN_USE_CASE_PORT = Symbol(
  'VALIDATE_TOKEN_USE_CASE_PORT',
);
export interface ValidateTokenUseCasePort {
  execute(token: string): Promise<ValidatedToken>;
}
