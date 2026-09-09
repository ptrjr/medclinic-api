import { NextFunction, Request, Response } from "express";
import { UserRole } from "../entities/user";

export function requireRole(role: UserRole) {
  return (
    request: Request,
    response: Response,
    next: NextFunction
  ) => {
    if (!request.user) {
      return response.status(401).json({
        message: "Usuário não autenticado",
      });
    }

    if (request.user.role !== role) {
      return response.status(403).json({
        message: "Acesso não autorizado",
      });
    }

    return next();
  };
}