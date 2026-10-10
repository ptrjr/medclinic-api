import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error';
import type { TokenProviderPort } from '../ports/token-provider.port';

export function createAuthMiddleware(tokens: TokenProviderPort): RequestHandler {
  return (request, _response, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? '');
    if (!match) throw new AppError('NAO_AUTENTICADO', 'Token ausente ou malformado.');
    request.user = tokens.verify(match[1]);
    next();
  };
}
