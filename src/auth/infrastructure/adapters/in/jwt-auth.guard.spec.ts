import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { ValidateTokenUseCasePort } from '../../../application/ports/in/validate-token.use-case';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockValidateTokenService: jest.Mocked<ValidateTokenUseCasePort>;
  let mockReflector: { getAllAndOverride: jest.Mock; get: jest.Mock };

  const publicPaths = ['/auth/login', '/auth/register'];

  beforeEach(() => {
    mockValidateTokenService = {
      execute: jest.fn(),
    };
    mockReflector = {
      getAllAndOverride: jest.fn().mockImplementation((key, targets) => {
        if (key !== IS_PUBLIC_KEY) return undefined;
        for (const target of targets) {
          if (target && typeof target === 'object') {
            const handler = target as { path?: string };
            if (handler.path && publicPaths.includes(handler.path)) {
              return true;
            }
          }
        }
        return undefined;
      }),
      get: jest.fn(),
    };

    guard = new JwtAuthGuard(mockValidateTokenService, mockReflector as any);
  });

  function createMockRequest(path: string, authHeader?: string): Request {
    return {
      path,
      headers: {
        authorization: authHeader,
      },
    } as unknown as Request;
  }

  function createMockContext(
    path: string,
    authHeader?: string,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => createMockRequest(path, authHeader),
      }),
      getHandler: () => ({ path }),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  describe('canActivate', () => {
    it('should allow public path /auth/login without token', async () => {
      const context = createMockContext('/auth/login');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockValidateTokenService.execute).not.toHaveBeenCalled();
    });

    it('should allow public path /auth/register without token', async () => {
      const context = createMockContext('/auth/register');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockValidateTokenService.execute).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when no authorization header', async () => {
      const context = createMockContext('/protected-endpoint');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when authorization header does not start with Bearer', async () => {
      const context = createMockContext(
        '/protected-endpoint',
        'Basic sometoken',
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should set user on request and return true for valid token', async () => {
      const mockRequest = createMockRequest(
        '/protected-endpoint',
        'Bearer valid-token',
      );
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: () => ({ path: '/protected-endpoint' }),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      mockValidateTokenService.execute.mockResolvedValue({
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockValidateTokenService.execute).toHaveBeenCalledWith(
        'valid-token',
      );
      expect(mockRequest.user).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
      });
    });
  });
});
