import type { GameReport } from '../../../domain/game-report';
export const REPORT_HISTORY_PORT = Symbol('REPORT_HISTORY_PORT');
export interface ReportHistoryPort {
  listOwned(ownerId: string): Promise<GameReport[]>;
  findOwned(ownerId: string, reportId: string): Promise<GameReport | null>;
}
