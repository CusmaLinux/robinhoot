import { UnauthorizedException } from '@nestjs/common';
import { ValidateTokenService } from './validate-token.service';
import type { JwtServicePort } from '../ports/out/jwt.service.port';
import type { UserRepositoryPort } from '../ports/out/user.repository.port';
import { UserEntity } from '../../domain/entities/user.entity';
import type { UserRole } from '../../domain/value-objects/user-role';

describe('ValidateTokenService', () => {
  let validateTokenService: ValidateTokenService;
  let mockJwtService: jest.Mocked<JwtServicePort>;
  let mockUserRepository: jest.Mocked<UserRepositoryPort>;

  const testUser: UserEntity = new UserEntity(
    'user-123',
    'test@example.com',
    'hashed-password',
    1,
    new Date(),
    ['user'] as UserRole[],
  );

  const validPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    roles: ['user'],
    tokenVersion: 1,
  };

  beforeEach(() => {
    mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      bumpTokenVersion: jest.fn(),
    };

    validateTokenService = new ValidateTokenService(
      mockJwtService,
      mockUserRepository,
    );
  });

  describe('execute', () => {
    it('should return validated token data on valid token', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      mockUserRepository.findById.mockResolvedValue(testUser);

      const result = await validateTokenService.execute('valid-token');

      expect(result).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
      });
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(
        validateTokenService.execute('invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(validateTokenService.execute('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token version mismatches', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      mockUserRepository.findById.mockResolvedValue(testUser);
      Object.defineProperty(testUser, 'tokenVersion', { value: 99 });

      await expect(validateTokenService.execute('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
