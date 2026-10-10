import type { RequestHandler } from 'express';
import type { UserRole } from '../domain/user';
import { AppError } from '../errors/app-error';

export function requireRoles(...allowedRoles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) throw new AppError('NAO_AUTENTICADO', 'Usuário não autenticado.');
    if (!request.user.roles.some((role) => allowedRoles.includes(role))) {
      throw new AppError('ACESSO_NEGADO', 'Perfil sem permissão para esta operação.');
    }
    next();
  };
}
