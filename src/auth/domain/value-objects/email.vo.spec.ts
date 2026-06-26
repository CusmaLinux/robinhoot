import { EmailVO } from './email.vo';

describe('EmailVO', () => {
  describe('create', () => {
    it('should create email value object', () => {
      const email = EmailVO.create('test@example.com');

      expect(email.value).toBe('test@example.com');
    });

    it('should return same value when accessing value property', () => {
      const email = EmailVO.create('user@domain.com');

      expect(email.value).toBe('user@domain.com');
    });
  });
});
