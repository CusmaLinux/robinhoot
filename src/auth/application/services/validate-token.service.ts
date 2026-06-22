import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import type {
  ValidateTokenUseCasePort,
  ValidatedToken,
} from '../ports/in/validate-token.use-case';
import type { JwtServicePort } from '../ports/out/jwt.service.port';
import { JWT_SERVICE_PORT } from '../ports/out/jwt.service.port';
import type { UserRepositoryPort } from '../ports/out/user.repository.port';
import { USER_REPOSITORY_PORT } from '../ports/out/user.repository.port';

@Injectable()
export class ValidateTokenService implements ValidateTokenUseCasePort {
  constructor(
    @Inject(JWT_SERVICE_PORT) private readonly jwtService: JwtServicePort,
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(token: string): Promise<ValidatedToken> {
    type TokenPayload = {
      sub: string;
      email: string;
      roles: string[];
      tokenVersion: number;
    };
    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Unauthorized');
    }

    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Unauthorized');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles,
    };
  }
}
