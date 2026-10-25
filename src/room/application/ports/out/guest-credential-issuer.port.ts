export const GUEST_CREDENTIAL_ISSUER_PORT = Symbol(
  'GUEST_CREDENTIAL_ISSUER_PORT',
);
export interface GuestCredentialIssuerPort {
  issue(): { playerId: string; credential: string; verifier: string };
}
