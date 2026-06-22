import { Injectable, Inject } from '@nestjs/common';
import type {
  LogoutUseCasePort,
  LogoutInput,
  LogoutOutput,
} from '../ports/in/logout.use-case';
import type { UserRepositoryPort } from '../ports/out/user.repository.port';
import { USER_REPOSITORY_PORT } from '../ports/out/user.repository.port';

@Injectable()
export class LogoutService implements LogoutUseCasePort {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(input: LogoutInput): Promise<LogoutOutput> {
    await this.userRepository.bumpTokenVersion(input.userId);
    return { success: true };
  }
}
