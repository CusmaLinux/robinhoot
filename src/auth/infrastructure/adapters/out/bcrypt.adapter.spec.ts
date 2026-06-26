import { BcryptAdapter } from './bcrypt.adapter';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('BcryptAdapter', () => {
  let adapter: BcryptAdapter;

  beforeEach(() => {
    adapter = new BcryptAdapter();
    jest.clearAllMocks();
  });

  describe('hash', () => {
    it('should hash password with 12 rounds', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-result');

      const result = await adapter.hash('password123');

      expect(result).toBe('hashed-result');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
    });
  });

  describe('compare', () => {
    it('should return true for matching password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await adapter.compare('password123', 'hashed');

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed');
    });

    it('should return false for non-matching password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await adapter.compare('wrongpassword', 'hashed');

      expect(result).toBe(false);
    });
  });
});
