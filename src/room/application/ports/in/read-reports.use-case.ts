import type { GameReport } from '../../../domain/game-report';
export const READ_REPORTS_PORT = Symbol('READ_REPORTS_PORT');
export interface ReadReportsPort {
  list(ownerId: string): Promise<GameReport[]>;
  read(ownerId: string, reportId: string): Promise<GameReport | null>;
}
