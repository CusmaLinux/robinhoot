import { UserEntity } from './user.entity';

describe('UserEntity', () => {
  const testDate = new Date('2024-01-01T00:00:00Z');

  it('should create instance with all properties', () => {
    const user = new UserEntity(
      'user-123',
      'test@example.com',
      'password-hash',
      5,
      testDate,
      ['admin', 'user'],
    );

    expect(user.id).toBe('user-123');
    expect(user.email).toBe('test@example.com');
    expect(user.passwordHash).toBe('password-hash');
    expect(user.tokenVersion).toBe(5);
    expect(user.createdAt).toBe(testDate);
    expect(user.roles).toEqual(['admin', 'user']);
  });

  it('should have readonly id property', () => {
    const user = new UserEntity(
      'user-123',
      'test@example.com',
      'hash',
      1,
      testDate,
      ['user'],
    );

    expect(Object.hasOwn(user, 'id')).toBe(true);
    expect(user.id).toBe('user-123');
  });

  it('should support empty roles array', () => {
    const user = new UserEntity(
      'user-123',
      'test@example.com',
      'hash',
      1,
      testDate,
      [],
    );

    expect(user.roles).toEqual([]);
  });
});
