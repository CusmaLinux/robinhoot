import { trustProxyHops } from './runtime.config';

describe('trusted ingress configuration', () => {
  it('supports direct local access and Render single-proxy ingress', () => {
    expect(trustProxyHops('0')).toBe(0);
    expect(trustProxyHops('1')).toBe(1);
  });

  it.each(['true', '-1', '1.5', '11', 'untrusted'])(
    'rejects unsafe or invalid proxy hop configuration %s',
    (value) => expect(() => trustProxyHops(value)).toThrow('TRUST_PROXY_HOPS'),
  );
});
