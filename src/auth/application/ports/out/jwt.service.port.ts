export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

export const JWT_SERVICE_PORT = Symbol('JWT_SERVICE_PORT');
export interface JwtServicePort {
  sign(payload: object): string;
  verify(token: string): JwtPayload;
}
