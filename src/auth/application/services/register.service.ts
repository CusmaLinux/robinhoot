import { Injectable, Inject, ConflictException } from '@nestjs/common';
import type {
  RegisterUseCasePort,
  RegisterInput,
  RegisterOutput,
} from '../ports/in/register.use-case';
import type { UserRepositoryPort } from '../ports/out/user.repository.port';
import { USER_REPOSITORY_PORT } from '../ports/out/user.repository.port';
import type { BcryptServicePort } from '../ports/out/bcrypt.service.port';
import { BCRYPT_SERVICE_PORT } from '../ports/out/bcrypt.service.port';

@Injectable()
export class RegisterService implements RegisterUseCasePort {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(BCRYPT_SERVICE_PORT)
    private readonly bcryptService: BcryptServicePort,
  ) {}

  async execute(input: RegisterInput): Promise<RegisterOutput> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await this.bcryptService.hash(input.password);
    const user = await this.userRepository.create(input.email, passwordHash);

    return { id: user.id, email: user.email };
  }
}
