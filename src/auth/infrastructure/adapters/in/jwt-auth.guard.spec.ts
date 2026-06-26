import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { ValidateTokenUseCasePort } from '../../../application/ports/in/validate-token.use-case';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockValidateTokenService: jest.Mocked<ValidateTokenUseCasePort>;

  beforeEach(() => {
    mockValidateTokenService = {
      execute: jest.fn(),
    };

    guard = new JwtAuthGuard(mockValidateTokenService);
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
    } as unknown as ExecutionContext;
  }

  describe('canActivate', () => {
    it('should allow public path /auth/login without token', async () => {
      const context = createMockContext('/auth/login');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockValidateTokenService.execute).not.toHaveBeenCalled();
    });

    it('should allow public path /auth/register without token', async () => {
      const context = createMockContext('/auth/register');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
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
      } as unknown as ExecutionContext;

      mockValidateTokenService.execute.mockResolvedValue({
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
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
