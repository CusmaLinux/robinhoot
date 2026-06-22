import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import type {
  LoginUseCasePort,
  LoginInput,
  LoginOutput,
} from '../ports/in/login.use-case';
import type { UserRepositoryPort } from '../ports/out/user.repository.port';
import { USER_REPOSITORY_PORT } from '../ports/out/user.repository.port';
import type { BcryptServicePort } from '../ports/out/bcrypt.service.port';
import { BCRYPT_SERVICE_PORT } from '../ports/out/bcrypt.service.port';
import type { JwtServicePort } from '../ports/out/jwt.service.port';
import { JWT_SERVICE_PORT } from '../ports/out/jwt.service.port';

@Injectable()
export class LoginService implements LoginUseCasePort {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(BCRYPT_SERVICE_PORT)
    private readonly bcryptService: BcryptServicePort,
    @Inject(JWT_SERVICE_PORT) private readonly jwtService: JwtServicePort,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.userRepository.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.bcryptService.compare(
      input.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      roles: [],
      tokenVersion: user.tokenVersion,
    });

    return { accessToken };
  }
}
