import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { UserRole } from '../../../domain/value-objects/user-role';
import { hasAllRoles } from '../../../domain/value-objects/user-role';
import { ROLES_KEY } from './roles.decorator';

interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: UserRole[];
}

interface HandlerWithMetadata {
  metadata: Map<string, UserRole[]>;
}

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    const request = context.switchToHttp().getRequest();
    const requiredRoles = this.getRequiredRoles(context);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const user = request.user as AuthenticatedUser | undefined;
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    const userRoles = user?.roles ?? [];

    if (!hasAllRoles(userRoles, requiredRoles)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }

  private getRequiredRoles(context: ExecutionContext): UserRole[] | null {
    const handler = context.getHandler() as unknown as HandlerWithMetadata;
    const metadata = handler.metadata;
    return metadata?.get(ROLES_KEY) ?? null;
  }
}
