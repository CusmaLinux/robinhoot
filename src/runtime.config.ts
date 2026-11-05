/** Set only the number of trusted ingress proxies; never trust all callers. */
export function trustProxyHops(value = process.env.TRUST_PROXY_HOPS ?? '0') {
  const hops = Number(value);
  const valid = [Number.isInteger(hops), hops >= 0, hops <= 10];
  if (!valid.every(Boolean))
    throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 10');
  return hops;
}
