import { NextFunction, Request, Response } from "express";
import { AuthService } from "../services/AuthService";
import { AppError } from "../errors/AppError";

export class AuthController {
  async register(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      const { name, email, password, role } = request.body;

      if (!name || !email || !password) {
        throw new AppError(
          "Nome, e-mail e senha são obrigatórios",
          400
        );
      }

      const authService = new AuthService();

      const user = await authService.register({
        name,
        email,
        password,
        role,
      });

      return response.status(201).json(user);
    } catch (error) {
      return next(error);
    }
  }

  async login(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      const { email, password } = request.body;

      if (!email || !password) {
        throw new AppError(
          "E-mail e senha são obrigatórios",
          400
        );
      }

      const authService = new AuthService();

      const result = await authService.login(email, password);

      return response.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}