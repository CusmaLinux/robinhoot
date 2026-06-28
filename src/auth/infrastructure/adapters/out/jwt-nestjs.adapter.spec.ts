import { JwtNestJsAdapter } from './jwt-nestjs.adapter';
import { JwtService } from '@nestjs/jwt';

describe('JwtNestJsAdapter', () => {
  let adapter: JwtNestJsAdapter;
  let mockJwtService: jest.Mocked<JwtService>;

  beforeEach(() => {
    mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    adapter = new JwtNestJsAdapter(mockJwtService);
  });

  describe('sign', () => {
    it('should delegate signing to JwtService', () => {
      mockJwtService.sign.mockReturnValue('signed-token');

      const result = adapter.sign({
        sub: 'user-123',
        email: 'test@example.com',
      });

      expect(result).toBe('signed-token');

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 'user-123',
        email: 'test@example.com',
      });
    });
  });

  describe('verify', () => {
    it('should delegate verification to JwtService and return payload', () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
        tokenVersion: 1,
      };
      mockJwtService.verify.mockReturnValue(payload);

      const result = adapter.verify('some-token');

      expect(result).toEqual(payload);

      expect(mockJwtService.verify).toHaveBeenCalledWith('some-token');
    });
  });
});
