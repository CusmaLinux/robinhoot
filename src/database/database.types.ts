import type { GameReport } from '../room/domain/game-report';
import { ColumnType, Generated } from 'kysely';
import type { QuizQuestion } from '../quiz/domain/quiz';

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  token_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  roles: UserRole[];
}

type UserRole = 'user' | 'admin';

export interface Database {
  reports: ReportsTable;
  users: UsersTable;
  quizzes: QuizzesTable;
}

export interface QuizzesTable {
  id: Generated<string>;
  owner_id: string;
  title: string;
  questions: ColumnType<QuizQuestion[], string, string>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ReportsTable {
  room_id: string;
  owner_id: string;
  document: ColumnType<GameReport, string, never>;
}
