import { ConflictException } from '@nestjs/common';
import { RegisterService } from './register.service';
import type { UserRepositoryPort } from '../ports/out/user.repository.port';
import type { BcryptServicePort } from '../ports/out/bcrypt.service.port';
import { UserEntity } from '../../domain/entities/user.entity';

describe('RegisterService', () => {
  let registerService: RegisterService;
  let mockUserRepository: jest.Mocked<UserRepositoryPort>;
  let mockBcryptService: jest.Mocked<BcryptServicePort>;

  const createdUser: UserEntity = new UserEntity(
    'user-456',
    'new@example.com',
    'hashed-password',
    1,
    new Date(),
    ['user'],
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

    registerService = new RegisterService(
      mockUserRepository,
      mockBcryptService,
    );
  });

  describe('execute', () => {
    it('should create user and return id and email', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockBcryptService.hash.mockResolvedValue('hashed-password');
      mockUserRepository.create.mockResolvedValue(createdUser);

      const result = await registerService.execute({
        email: 'new@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        id: 'user-456',
        email: 'new@example.com',
      });

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
        'new@example.com',
      );

      expect(mockBcryptService.hash).toHaveBeenCalledWith('password123');

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        'new@example.com',
        'hashed-password',
      );
    });

    it('should throw ConflictException when email already exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(createdUser);

      await expect(
        registerService.execute({
          email: 'existing@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
