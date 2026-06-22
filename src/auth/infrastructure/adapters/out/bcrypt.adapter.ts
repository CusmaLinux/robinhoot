import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { BcryptServicePort } from '../../../application/ports/out/bcrypt.service.port';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class BcryptAdapter implements BcryptServicePort {
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
