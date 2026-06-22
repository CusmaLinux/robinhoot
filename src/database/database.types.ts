import { ColumnType, Generated } from 'kysely';

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  token_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface Database {
  users: UsersTable;
}
