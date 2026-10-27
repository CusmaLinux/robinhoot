import { Inject, Injectable } from '@nestjs/common';
import { REPORT_HISTORY_PORT } from '../ports/out/report-history.port';
import type { ReportHistoryPort } from '../ports/out/report-history.port';
import type { ReadReportsPort } from '../ports/in/read-reports.use-case';

@Injectable()
export class ReadReportsService implements ReadReportsPort {
  constructor(
    @Inject(REPORT_HISTORY_PORT) private readonly history: ReportHistoryPort,
  ) {}
  list(ownerId: string) {
    return this.history.listOwned(ownerId);
  }
  read(ownerId: string, reportId: string) {
    return this.history.findOwned(ownerId, reportId);
  }
}
