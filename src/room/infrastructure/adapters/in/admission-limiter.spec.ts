import { AdmissionLimiter } from './admission-limiter';

describe('Admission attempt bounds', () => {
  it('throttles a connection after ten attempts in sixty seconds', () => {
    const limiter = new AdmissionLimiter();
    for (let i = 0; i < 10; i++) limiter.check('connection', 'source');
    expect(() => limiter.check('connection', 'source')).toThrow(
      'Too many admission attempts',
    );
  });
  it('bounds attempts by source even across new connections', () => {
    const limiter = new AdmissionLimiter();
    for (let i = 0; i < 60; i++) limiter.check(`connection-${i}`, 'source');
    expect(() => limiter.check('replacement', 'source')).toThrow(
      'Too many admission attempts',
    );
  });
  it('fails closed when the bounded source table is full', () => {
    const limiter = new AdmissionLimiter({
      connection: 10,
      source: 60,
      windowMs: 60_000,
      maxSources: 1,
    });
    limiter.check('a', 'first');
    expect(() => limiter.check('b', 'second')).toThrow(
      'Too many admission attempts',
    );
  });
  it('resets windows and reclaims expired source entries after sixty seconds', () => {
    let now = 0;
    const limiter = new AdmissionLimiter(
      { connection: 1, source: 1, windowMs: 60_000, maxSources: 1 },
      () => now,
    );
    limiter.check('a', 'first');
    now = 60_000;
    expect(() => limiter.check('a', 'second')).not.toThrow();
  });
  it('retains the source budget when a connection disconnects', () => {
    const limiter = new AdmissionLimiter({
      connection: 10,
      source: 1,
      windowMs: 60_000,
      maxSources: 10,
    });
    limiter.check('a', 'source');
    limiter.release('a');
    expect(() => limiter.check('b', 'source')).toThrow(
      'Too many admission attempts',
    );
  });
});
