import { UserEntity } from '../../../domain/entities/user.entity';

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<UserEntity | null>;
}
