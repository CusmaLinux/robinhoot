import { Injectable, Inject } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { Database } from '../../../../database/database.types';
import { UserRepositoryPort } from '../../../application/ports/out/user.repository.port';
import { UserEntity } from '../../../domain/entities/user.entity';
import type { UserRole } from '../../../domain/value-objects/user-role';

@Injectable()
export class UserKyselyAdapter implements UserRepositoryPort {
  constructor(
    @Inject('KYSELY_INSTANCE') private readonly db: Kysely<Database>,
  ) {}

  private parseRoles(rolesValue: unknown): UserRole[] {
    if (Array.isArray(rolesValue)) {
      return rolesValue as UserRole[];
    }
    if (typeof rolesValue === 'string') {
      try {
        return JSON.parse(rolesValue) as UserRole[];
      } catch {
        return ['user'];
      }
    }
    return ['user'];
  }

  private buildUserEntity(row: Record<string, unknown>): UserEntity {
    const roles = this.parseRoles(row.roles);
    return new UserEntity(
      row.id as string,
      row.email as string,
      row.password_hash as string,
      row.token_version as number,
      row.created_at as Date,
      roles,
    );
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const row = await this.db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst();

    if (!row) return null;

    return this.buildUserEntity(row);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const row = await this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) return null;

    return this.buildUserEntity(row);
  }

  async create(email: string, passwordHash: string): Promise<UserEntity> {
    const [row] = await this.db
      .insertInto('users')
      .values({
        email,
        password_hash: passwordHash,
        token_version: 1,
        created_at: new Date().toISOString(),
        roles: sql`${JSON.stringify(['user'])}::jsonb`,
      })
      .returningAll()
      .execute();

    return this.buildUserEntity(row);
  }

  async bumpTokenVersion(userId: string): Promise<void> {
    await this.db
      .updateTable('users')
      .set({ token_version: sql`token_version + 1` })
      .where('id', '=', userId)
      .executeTakeFirst();
  }
}
