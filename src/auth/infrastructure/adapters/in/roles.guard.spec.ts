import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';
import type { UserRole } from '../../../domain/value-objects/user-role';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let mockReflector: { get: jest.Mock };
  let mockRequest: { user?: { roles: string[] } };

  beforeEach(() => {
    mockReflector = { get: jest.fn() };
    guard = new RolesGuard(mockReflector as any);
    mockRequest = { user: { roles: [] } };
  });

  function createMockContext(roles: UserRole[] | null): ExecutionContext {
    mockReflector.get.mockImplementation((key: string) => {
      if (key === ROLES_KEY) return roles;
      return undefined;
    });
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getHandler: jest.fn().mockReturnValue({}),
    } as unknown as ExecutionContext;
  }

  describe('canActivate', () => {
    it('should allow request when no @Roles decorator is present', () => {
      const context = createMockContext(null);
      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow admin to access user-protected endpoint', () => {
      mockRequest.user!.roles = ['admin'];
      const context = createMockContext(['user']);

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should deny user from accessing admin-protected endpoint', () => {
      mockRequest.user!.roles = ['user'];
      const context = createMockContext(['admin']);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should allow user with both roles to access admin endpoint', () => {
      mockRequest.user!.roles = ['user', 'admin'];
      const context = createMockContext(['admin']);

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should deny user with only user role from admin+user endpoint', () => {
      mockRequest.user!.roles = ['user'];
      const context = createMockContext(['admin', 'user']);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should allow admin with both roles to access admin+user endpoint', () => {
      mockRequest.user!.roles = ['admin', 'user'];
      const context = createMockContext(['admin', 'user']);

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should deny request when user has no roles', () => {
      mockRequest.user!.roles = [];
      const context = createMockContext(['user']);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should deny request when user is undefined', () => {
      mockRequest.user = undefined;
      const context = createMockContext(['user']);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
