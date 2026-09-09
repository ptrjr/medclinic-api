import { Request, Response } from "express";
import { AuthService } from "../services/AuthService";

export class AuthController {
  async register(request: Request, response: Response) {
    try {
      const { name, email, password, role } = request.body;

      if (!name || !email || !password) {
        return response.status(400).json({
          message: "Nome, e-mail e senha são obrigatórios",
        });
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
      if (error instanceof Error) {
        if (error.message === "E-mail já cadastrado") {
          return response.status(409).json({
            message: error.message,
          });
        }

        return response.status(400).json({
          message: error.message,
        });
      }

      return response.status(500).json({
        message: "Erro interno do servidor",
      });
    }
  }

  async login(request: Request, response: Response) {
    try {
      const { email, password } = request.body;

      if (!email || !password) {
        return response.status(400).json({
          message: "E-mail e senha são obrigatórios",
        });
      }

      const authService = new AuthService();

      const result = await authService.login(email, password);

      return response.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Credenciais inválidas") {
        return response.status(401).json({
          message: error.message,
        });
      }

      console.error(error);

      return response.status(500).json({
        message: "Erro interno do servidor",
      });
    }
  }
}
