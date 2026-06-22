import {
  Injectable,
  Inject,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ValidateTokenUseCasePort } from '../../../application/ports/in/validate-token.use-case';
import { VALIDATE_TOKEN_USE_CASE_PORT } from '../../../application/ports/in/validate-token.use-case';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(VALIDATE_TOKEN_USE_CASE_PORT)
    private readonly validateTokenService: ValidateTokenUseCasePort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    const publicPaths = ['/auth/login', '/auth/register'];
    if (publicPaths.some((p) => request.path === p)) {
      return true;
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Unauthorized');
    }

    const token = authHeader.slice(7);

    const validated = await this.validateTokenService.execute(token);
    request.user = {
      userId: validated.userId,
      email: validated.email,
      roles: validated.roles,
    };

    return true;
  }
}
