import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const migrationName = args[0];

if (!migrationName) {
  console.error('❌ Error: Please provide a migration name.');
  console.log('💡 Example: pnpm db:migration:make add_users_table');
  process.exit(1);
}

const date = new Date();
const timestamp = date
  .toISOString()
  .replace(/[-:T.]/g, '')
  .slice(0, 14);

const fileName = `${timestamp}-${migrationName}.ts`;
const migrationsDir = path.join(__dirname, 'migrations');

if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

const filePath = path.join(migrationsDir, fileName);

// Boilerplate Kysely migration code
const template = `import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // TODO: Write your migration here
}

export async function down(db: Kysely<any>): Promise<void> {
  // TODO: Write your rollback here
}
`;

fs.writeFileSync(filePath, template, 'utf8');

console.log(`✅ Migration created successfully!`);
console.log(`📁 File: src/database/migrations/${fileName}`);
