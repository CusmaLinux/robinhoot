/** Syntactic validation only. Never resolve hosts or retrieve remote bytes. */
export function isQuestionImageUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 2048 &&
    /^https:\/\//i.test(value) &&
    !/[\s\p{Cc}\\]/u.test(value) &&
    !/%(?![a-f\d]{2})/i.test(value) &&
    hasCredentialFreeHttpsAuthority(value)
  );
}

function hasCredentialFreeHttpsAuthority(value: string): boolean {
  const authority = value.slice(8).split(/[/?#]/, 1)[0];
  if (!authority || authority.includes('@')) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !!url.hostname &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
