import type { ReportHistoryPort } from '../../../application/ports/out/report-history.port';
import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { KYSELY_TOKEN } from '../../../../database/database.provider';
import type { Database } from '../../../../database/database.types';
import { freezeGameReport, type GameReport } from '../../../domain/game-report';
import type { ReportRepositoryPort } from '../../../application/ports/out/report.repository.port';

@Injectable()
export class ReportKyselyAdapter
  implements ReportRepositoryPort, ReportHistoryPort
{
  constructor(@Inject(KYSELY_TOKEN) private readonly db: Kysely<Database>) {}
  async listOwned(ownerId: string): Promise<GameReport[]> {
    const rows = await this.db
      .selectFrom('reports')
      .select('document')
      .where('owner_id', '=', ownerId)
      .orderBy(sql`document->>'completedAt'`, 'desc')
      .orderBy('room_id', 'asc')
      .execute();
    return rows.map((row) => freezeGameReport(row.document));
  }
  async findOwned(
    ownerId: string,
    reportId: string,
  ): Promise<GameReport | null> {
    const row = await this.db
      .selectFrom('reports')
      .select('document')
      .where('owner_id', '=', ownerId)
      .where('room_id', '=', reportId)
      .executeTakeFirst();
    return row ? freezeGameReport(row.document) : null;
  }
  async saveOnce(report: GameReport): Promise<GameReport> {
    return this.db.transaction().execute(async (transaction) => {
      await sql`select set_config('statement_timeout', '5000', true)`.execute(
        transaction,
      );
      await transaction
        .insertInto('reports')
        .values({
          room_id: report.roomId,
          owner_id: report.ownerId,
          document: JSON.stringify(report),
        })
        .onConflict((conflict) => conflict.column('room_id').doNothing())
        .execute();
      const row = await transaction
        .selectFrom('reports')
        .selectAll()
        .where('room_id', '=', report.roomId)
        .where('owner_id', '=', report.ownerId)
        .executeTakeFirstOrThrow();
      return freezeGameReport(row.document);
    });
  }
}
