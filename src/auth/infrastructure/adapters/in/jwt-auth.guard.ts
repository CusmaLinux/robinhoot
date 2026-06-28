import {
  Injectable,
  Inject,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { ValidateTokenUseCasePort } from '../../../application/ports/in/validate-token.use-case';
import { VALIDATE_TOKEN_USE_CASE_PORT } from '../../../application/ports/in/validate-token.use-case';
import { IS_PUBLIC_KEY } from './public.decorator';

declare module 'express' {
  interface Request {
    user: { userId: string; email: string; roles: string[] };
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(VALIDATE_TOKEN_USE_CASE_PORT)
    private readonly validateTokenService: ValidateTokenUseCasePort,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

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
