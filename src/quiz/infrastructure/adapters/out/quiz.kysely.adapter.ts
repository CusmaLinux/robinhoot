import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { KYSELY_TOKEN } from '../../../../database/database.provider';
import type { Database } from '../../../../database/database.types';
import type { Quiz, QuizContent } from '../../../domain/quiz';
import type { QuizRepositoryPort } from '../../../application/ports/out/quiz.repository.port';

@Injectable()
export class QuizKyselyAdapter implements QuizRepositoryPort {
  constructor(@Inject(KYSELY_TOKEN) private readonly db: Kysely<Database>) {}

  async deleteOwned(ownerId: string, id: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('quizzes')
      .where('owner_id', '=', ownerId)
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    return result.numDeletedRows > 0n;
  }

  async saveOwned(
    ownerId: string,
    id: string,
    content: QuizContent,
  ): Promise<Quiz | null> {
    const row = await this.db
      .updateTable('quizzes')
      .set({
        title: content.title,
        questions: JSON.stringify(content.questions),
        updated_at: sql`clock_timestamp()`,
      })
      .where('owner_id', '=', ownerId)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row
      ? {
          id: row.id,
          title: row.title,
          questions: row.questions,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      : null;
  }

  async create(ownerId: string, title: string): Promise<Quiz> {
    const row = await this.db
      .insertInto('quizzes')
      .values({ owner_id: ownerId, title, questions: sql`'[]'::jsonb` })
      .returningAll()
      .executeTakeFirstOrThrow();
    return {
      id: row.id,
      title: row.title,
      questions: row.questions,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findOwned(ownerId: string, id: string): Promise<Quiz | null> {
    const row = await this.db
      .selectFrom('quizzes')
      .selectAll()
      .where('owner_id', '=', ownerId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row
      ? {
          id: row.id,
          title: row.title,
          questions: row.questions,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      : null;
  }

  async listOwned(ownerId: string): Promise<Quiz[]> {
    const rows = await this.db
      .selectFrom('quizzes')
      .selectAll()
      .where('owner_id', '=', ownerId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .execute();
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      questions: row.questions,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}
