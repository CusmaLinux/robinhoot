import { Injectable, Inject } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Database } from '../../../../database/database.types';
import { UserRepositoryPort } from '../../../application/ports/out/user.repository.port';
import { UserEntity } from '../../../domain/entities/user.entity';

@Injectable()
export class UserKyselyAdapter implements UserRepositoryPort {
  constructor(
    @Inject('KYSELY_INSTANCE') private readonly db: Kysely<Database>,
  ) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    const row = await this.db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst();

    if (!row) return null;

    // Map Kysely database row to your rich Domain Entity
    return new UserEntity(row.id, row.email, row.created_at);
  }
}
