import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import type { GuestCredentialIssuerPort } from '../../../application/ports/out/guest-credential-issuer.port';

export class RandomGuestCredentialIssuer implements GuestCredentialIssuerPort {
  verify(credential: string, verifier: string): boolean {
    const actual = createHash('sha256').update(credential).digest();
    const expected = Buffer.from(verifier, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  issue() {
    const credential = randomBytes(32).toString('base64url');
    return {
      playerId: randomUUID(),
      credential,
      verifier: createHash('sha256').update(credential).digest('hex'),
    };
  }
}
