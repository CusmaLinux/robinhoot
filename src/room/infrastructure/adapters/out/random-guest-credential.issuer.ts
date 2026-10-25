import { createHash, randomBytes, randomUUID } from 'crypto';
import type { GuestCredentialIssuerPort } from '../../../application/ports/out/guest-credential-issuer.port';

export class RandomGuestCredentialIssuer implements GuestCredentialIssuerPort {
  issue() {
    const credential = randomBytes(32).toString('base64url');
    return {
      playerId: randomUUID(),
      credential,
      verifier: createHash('sha256').update(credential).digest('hex'),
    };
  }
}
