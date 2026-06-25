import { Roles } from './roles.decorator';

describe('Roles decorator', () => {
  it('should return a decorator function', () => {
    const decorator = Roles(['admin', 'user']);
    expect(typeof decorator).toBe('function');
  });

  it('should accept single role', () => {
    const decorator = Roles(['admin']);
    expect(typeof decorator).toBe('function');
  });

  it('should accept multiple roles', () => {
    const decorator = Roles(['admin', 'user']);
    expect(typeof decorator).toBe('function');
  });

  it('should return different functions for different role sets', () => {
    const decorator1 = Roles(['admin']);
    const decorator2 = Roles(['user']);
    const decorator3 = Roles(['admin', 'user']);
    expect(decorator1).not.toBe(decorator2);
    expect(decorator2).not.toBe(decorator3);
    expect(decorator1).not.toBe(decorator3);
  });
});
