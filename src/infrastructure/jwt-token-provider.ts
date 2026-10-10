import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { UserRole, type AuthPrincipal } from '../domain/user';
import { AppError } from '../errors/app-error';
import type { TokenProviderPort } from '../ports/token-provider.port';

const claimsSchema = z.object({ sub: z.uuid(), roles: z.array(z.enum(UserRole)).min(1) });

export class JwtTokenProvider implements TokenProviderPort {
  constructor(
    private readonly secret: string,
    private readonly expiresInSeconds: number,
  ) {}

  public sign(principal: AuthPrincipal): string {
    return jwt.sign({ roles: principal.roles }, this.secret, {
      subject: principal.id,
      algorithm: 'HS256',
      issuer: 'medclinic-api',
      audience: 'medclinic-api',
      expiresIn: this.expiresInSeconds,
    });
  }

  public verify(token: string): AuthPrincipal {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: 'medclinic-api',
        audience: 'medclinic-api',
      });
      const claims = claimsSchema.parse(decoded);
      return { id: claims.sub, roles: claims.roles };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof z.ZodError) {
        throw new AppError('NAO_AUTENTICADO', 'Token inválido ou expirado.');
      }
      throw error;
    }
  }
}
