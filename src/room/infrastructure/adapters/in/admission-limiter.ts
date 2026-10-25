import { LobbyError } from '../../../domain/lobby';

export interface AdmissionLimits {
  connection: number;
  source: number;
  windowMs: number;
  maxSources: number;
}
export const ADMISSION_LIMITS = Symbol('ADMISSION_LIMITS');
export const DEFAULT_ADMISSION_LIMITS: AdmissionLimits = {
  connection: 10,
  source: 60,
  windowMs: 60_000,
  maxSources: 10_000,
};
type Window = { count: number; until: number };

export class AdmissionLimiter {
  private readonly sources = new Map<string, Window>();
  private readonly connections = new Map<string, Window>();
  constructor(
    private readonly limits = DEFAULT_ADMISSION_LIMITS,
    private readonly now = Date.now,
  ) {}
  release(connectionId: string) {
    this.connections.delete(connectionId);
  }
  check(connectionId: string, address: string) {
    const now = this.now();
    let window = this.connections.get(connectionId);
    if (!window || window.until <= now) {
      window = { count: 0, until: now + this.limits.windowMs };
      this.connections.set(connectionId, window);
    }
    const source = this.sourceWindow(address, now);
    const sourceExceeded = ++source.count > this.limits.source;
    if (++window.count > this.limits.connection || sourceExceeded)
      throw new LobbyError(
        'ADMISSION_THROTTLED',
        'Too many admission attempts',
      );
  }
  private sourceWindow(address: string, now: number): Window {
    let source = this.sources.get(address);
    if (!source || source.until <= now) {
      for (const [key, value] of this.sources)
        if (value.until <= now) this.sources.delete(key);
      if (this.sources.size >= this.limits.maxSources)
        throw new LobbyError(
          'ADMISSION_THROTTLED',
          'Too many admission attempts',
        );
      source = { count: 0, until: now + this.limits.windowMs };
      this.sources.set(address, source);
    }
    return source;
  }
}
