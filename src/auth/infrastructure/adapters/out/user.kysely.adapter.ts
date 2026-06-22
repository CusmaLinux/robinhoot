import { Injectable, Inject } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
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

    return new UserEntity(
      row.id,
      row.email,
      row.password_hash,
      row.token_version,
      row.created_at,
    );
  }

  async findById(id: string): Promise<UserEntity | null> {
    const row = await this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) return null;

    return new UserEntity(
      row.id,
      row.email,
      row.password_hash,
      row.token_version,
      row.created_at,
    );
  }

  async create(email: string, passwordHash: string): Promise<UserEntity> {
    const [row] = await this.db
      .insertInto('users')
      .values({
        email,
        password_hash: passwordHash,
        token_version: 1,
        created_at: new Date().toISOString(),
      })
      .returningAll()
      .execute();

    return new UserEntity(
      row.id,
      row.email,
      row.password_hash,
      row.token_version,
      row.created_at,
    );
  }

  async bumpTokenVersion(userId: string): Promise<void> {
    await this.db
      .updateTable('users')
      .set({ token_version: sql`token_version + 1` })
      .where('id', '=', userId)
      .executeTakeFirst();
  }
}
