import type { AuthPrincipal } from '../../domain/user';

declare global {
  namespace Express {
    interface Request {
      user?: AuthPrincipal;
    }
  }
}
