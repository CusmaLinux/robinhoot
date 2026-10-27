import type { GameReport } from '../../../domain/game-report';
export const REPORT_REPOSITORY_PORT = Symbol('REPORT_REPOSITORY_PORT');
export interface ReportRepositoryPort {
  saveOnce(report: GameReport): Promise<GameReport>;
}
