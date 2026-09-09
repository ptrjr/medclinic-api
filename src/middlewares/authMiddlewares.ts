import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

interface TokenPayload {
  sub: string;
  role: string;
}

export function authMiddleware(
  request: Request,
  response: Response,
  next: NextFunction
) {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return response.status(401).json({
      message: "Token não informado",
    });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2) {
    return response.status(401).json({
      message: "Token inválido",
    });
  }

  const [scheme, token] = parts;

  if (scheme !== "Bearer") {
    return response.status(401).json({
      message: "Token inválido",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as TokenPayload;

    request.user = {
      id: decoded.sub,
      role: decoded.role,
    };

    return next();
  } catch {
    return response.status(401).json({
      message: "Token inválido ou expirado",
    });
  }
}