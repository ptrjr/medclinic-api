import type { AuthPrincipal } from '../domain/user';

export interface TokenProviderPort {
  sign(principal: AuthPrincipal): string;
  verify(token: string): AuthPrincipal;
}
