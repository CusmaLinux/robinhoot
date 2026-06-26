import { CurrentUserData } from './current-user.decorator';

describe('CurrentUserData', () => {
  it('should have userId, email, and roles properties', () => {
    const user: CurrentUserData = {
      userId: 'user-123',
      email: 'test@example.com',
      roles: ['user'],
    };

    expect(user.userId).toBe('user-123');
    expect(user.email).toBe('test@example.com');
    expect(user.roles).toEqual(['user']);
  });

  it('should support empty roles array', () => {
    const user: CurrentUserData = {
      userId: 'user-456',
      email: 'another@example.com',
      roles: [],
    };

    expect(user.roles).toEqual([]);
  });
});
