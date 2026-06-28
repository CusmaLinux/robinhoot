import { LogoutService } from './logout.service';
import type { UserRepositoryPort } from '../ports/out/user.repository.port';

describe('LogoutService', () => {
  let logoutService: LogoutService;
  let mockUserRepository: jest.Mocked<UserRepositoryPort>;

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      bumpTokenVersion: jest.fn(),
    };

    logoutService = new LogoutService(mockUserRepository);
  });

  describe('execute', () => {
    it('should bump token version and return success', async () => {
      mockUserRepository.bumpTokenVersion.mockResolvedValue(undefined);

      const result = await logoutService.execute({ userId: 'user-123' });

      expect(result).toEqual({ success: true });

      expect(mockUserRepository.bumpTokenVersion).toHaveBeenCalledWith(
        'user-123',
      );
    });
  });
});
