import { UnauthorizedException } from '@nestjs/common';
import { LoginService } from './login.service';
import type { UserRepositoryPort } from '../ports/out/user.repository.port';
import type { BcryptServicePort } from '../ports/out/bcrypt.service.port';
import type { JwtServicePort } from '../ports/out/jwt.service.port';
import { UserEntity } from '../../domain/entities/user.entity';
import type { UserRole } from '../../domain/value-objects/user-role';

describe('LoginService', () => {
  let loginService: LoginService;
  let mockUserRepository: jest.Mocked<UserRepositoryPort>;
  let mockBcryptService: jest.Mocked<BcryptServicePort>;
  let mockJwtService: jest.Mocked<JwtServicePort>;

  const testUser: UserEntity = new UserEntity(
    'user-123',
    'test@example.com',
    'hashed-password',
    1,
    new Date(),
    ['user'] as UserRole[],
  );

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      bumpTokenVersion: jest.fn(),
    };

    mockBcryptService = {
      hash: jest.fn(),
      compare: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    loginService = new LoginService(
      mockUserRepository,
      mockBcryptService,
      mockJwtService,
    );
  });

  describe('execute', () => {
    it('should return access token on successful login', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(testUser);
      mockBcryptService.compare.mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await loginService.execute({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({ accessToken: 'jwt-token' });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockBcryptService.compare).toHaveBeenCalledWith(
        'password123',
        'hashed-password',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
        tokenVersion: 1,
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(
        loginService.execute({
          email: 'nonexistent@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(testUser);
      mockBcryptService.compare.mockResolvedValue(false);

      await expect(
        loginService.execute({
          email: 'test@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
