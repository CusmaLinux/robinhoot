import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let mockRequest: { user?: { roles: string[] } };

  beforeEach(() => {
    guard = new RolesGuard();
    mockRequest = { user: { roles: [] } };
  });

  function createMockContext(
    handlerMetadata: Map<string, unknown> | null,
  ): ExecutionContext {
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getHandler: jest.fn().mockReturnValue({
        metadata: handlerMetadata,
      }),
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
      const metadata = new Map([[ROLES_KEY, ['user']]]);
      const context = createMockContext(metadata);

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should deny user from accessing admin-protected endpoint', () => {
      mockRequest.user!.roles = ['user'];
      const metadata = new Map([[ROLES_KEY, ['admin']]]);
      const context = createMockContext(metadata);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should allow user with both roles to access admin endpoint', () => {
      mockRequest.user!.roles = ['user', 'admin'];
      const metadata = new Map([[ROLES_KEY, ['admin']]]);
      const context = createMockContext(metadata);

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should deny user with only user role from admin+user endpoint', () => {
      mockRequest.user!.roles = ['user'];
      const metadata = new Map([[ROLES_KEY, ['admin', 'user']]]);
      const context = createMockContext(metadata);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should allow admin with both roles to access admin+user endpoint', () => {
      mockRequest.user!.roles = ['admin', 'user'];
      const metadata = new Map([[ROLES_KEY, ['admin', 'user']]]);
      const context = createMockContext(metadata);

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should deny request when user has no roles', () => {
      mockRequest.user!.roles = [];
      const metadata = new Map([[ROLES_KEY, ['user']]]);
      const context = createMockContext(metadata);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should deny request when user is undefined', () => {
      mockRequest.user = undefined;
      const metadata = new Map([[ROLES_KEY, ['user']]]);
      const context = createMockContext(metadata);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
