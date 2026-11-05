import type { PoolConfig } from 'pg';

function urlConfig(value: string): PoolConfig {
  try {
    const url = new URL(value);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      !url.username ||
      !url.password ||
      url.pathname.length < 2
    )
      throw new Error();
    return {
      host: url.hostname,
      port: Number(url.port || 5432),
      database: decodeURIComponent(url.pathname.slice(1)),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      // Do not pass URL SSL parameters to pg: they can override verification.
      ssl: { rejectUnauthorized: true },
    };
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL');
  }
}

/** URLs always use verified TLS; DB_* remains available for local PostgreSQL. */
export function databaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): PoolConfig {
  const limits = {
    max: 5,
    connectionTimeoutMillis: 10000,
    query_timeout: 5000,
    statement_timeout: 5000,
    idleTimeoutMillis: 30000,
  };
  if (env.DATABASE_URL) return { ...limits, ...urlConfig(env.DATABASE_URL) };
  if (!env.DB_PASSWORD)
    throw new Error('DB_PASSWORD environment variable is not set');
  return {
    ...limits,
    host: env.DB_HOST || 'localhost',
    database: env.DB_NAME || 'robinhoot',
    user: env.DB_USER || 'postgres',
    password: env.DB_PASSWORD,
    port: Number(env.DB_PORT || 5432),
  };
}
