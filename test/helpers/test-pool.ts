import { Pool, PoolClient } from 'pg';

function proxyGet(target: PoolClient, prop: string): unknown {
  if (prop === 'release') return () => {};
  // Application transactions nest inside each test's rollback boundary.
  if (prop === 'query')
    return (
      query: string | { text: string; values?: unknown[] },
      values?: unknown[],
    ) => {
      const text = typeof query === 'string' ? query : query.text;
      const command = text.trim().toLowerCase();
      const translated =
        command === 'begin'
          ? 'SAVEPOINT app_transaction'
          : command === 'commit'
            ? 'RELEASE SAVEPOINT app_transaction'
            : command === 'rollback'
              ? 'ROLLBACK TO SAVEPOINT app_transaction'
              : undefined;
      return translated
        ? target.query(translated)
        : typeof query === 'string'
          ? target.query(query, values)
          : target.query(query);
    };
  const value: unknown = target[prop as keyof PoolClient];
  return typeof value === 'function'
    ? (value as (...args: unknown[]) => unknown).bind(target)
    : value;
}

export class TestPool extends Pool {
  transactionClient: PoolClient | null = null;

  async connect(): Promise<PoolClient> {
    if (this.transactionClient) {
      return new Proxy(this.transactionClient, {
        get: proxyGet as ProxyHandler<PoolClient>['get'],
      });
    }
    return super.connect();
  }
}
