import { ROLE_HIERARCHY, hasRequiredRole, hasAllRoles } from './user-role';

describe('UserRole', () => {
  describe('ROLE_HIERARCHY', () => {
    it('should have admin before user', () => {
      expect(ROLE_HIERARCHY).toEqual(['admin', 'user']);
    });

    it('should be readonly tuple', () => {
      expect(ROLE_HIERARCHY).toHaveLength(2);
    });
  });

  describe('hasRequiredRole', () => {
    it('should return true when user has exact role', () => {
      expect(hasRequiredRole(['user'], 'user')).toBe(true);
      expect(hasRequiredRole(['admin'], 'admin')).toBe(true);
    });

    it('should return true when admin has user role (hierarchy)', () => {
      expect(hasRequiredRole(['admin'], 'user')).toBe(true);
    });

    it('should return false when user lacks admin role', () => {
      expect(hasRequiredRole(['user'], 'admin')).toBe(false);
    });

    it('should return false when user has no roles', () => {
      expect(hasRequiredRole([], 'user')).toBe(false);
    });

    it('should return true when user has one of multiple roles', () => {
      expect(hasRequiredRole(['admin', 'user'], 'admin')).toBe(true);
      expect(hasRequiredRole(['admin', 'user'], 'user')).toBe(true);
    });
  });

  describe('hasAllRoles', () => {
    it('should return true when user has all required roles', () => {
      expect(hasAllRoles(['admin', 'user'], ['admin'])).toBe(true);
      expect(hasAllRoles(['admin', 'user'], ['user'])).toBe(true);
      expect(hasAllRoles(['admin', 'user'], ['admin', 'user'])).toBe(true);
    });

    it('should return true when admin satisfies user requirement', () => {
      expect(hasAllRoles(['admin'], ['user'])).toBe(true);
    });

    it('should return false when user lacks one required role', () => {
      expect(hasAllRoles(['user'], ['admin', 'user'])).toBe(false);
    });

    it('should return false when user has no roles', () => {
      expect(hasAllRoles([], ['user'])).toBe(false);
    });

    it('should return true for empty required roles', () => {
      expect(hasAllRoles(['user'], [])).toBe(true);
      expect(hasAllRoles([], [])).toBe(true);
    });
  });
});
