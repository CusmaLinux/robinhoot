import { UserEntity } from '../../../domain/entities/user.entity';

export const USER_REPOSITORY_PORT = Symbol('USER_REPOSITORY_PORT');
export interface UserRepositoryPort {
  findByEmail(email: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  create(email: string, passwordHash: string): Promise<UserEntity>;
  bumpTokenVersion(userId: string): Promise<void>;
}
