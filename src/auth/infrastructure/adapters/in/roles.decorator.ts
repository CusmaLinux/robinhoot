import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../../domain/value-objects/user-role';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
