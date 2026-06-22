export const BCRYPT_SERVICE_PORT = Symbol('BCRYPT_SERVICE_PORT');
export interface BcryptServicePort {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}
