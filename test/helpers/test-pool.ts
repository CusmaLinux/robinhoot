import { Pool, PoolClient } from 'pg';

function proxyGet(target: PoolClient, prop: string): unknown {
  if (prop === 'release') return () => {};
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
