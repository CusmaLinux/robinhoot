import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { UserRole } from '../../../domain/value-objects/user-role';
import { hasAllRoles } from '../../../domain/value-objects/user-role';
import { ROLES_KEY } from './roles.decorator';
import { Reflector } from '@nestjs/core';

interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: UserRole[];
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    const request = context.switchToHttp().getRequest();
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */

    const requiredRoles = this.reflector.get<UserRole[]>(
      ROLES_KEY,
      context.getHandler(),
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    const user = request.user as AuthenticatedUser | undefined;
    const userRoles = user?.roles ?? [];
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */

    if (!hasAllRoles(userRoles, requiredRoles)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
