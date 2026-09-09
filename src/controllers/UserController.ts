import { Request, Response } from "express";
import { UserRepository } from "../repositories/UserRepository";

export class UserController {
  async me(request: Request, response: Response) {
    try {
      const userId = request.user?.id;

      if (!userId) {
        return response.status(401).json({
          message: "Usuário não autenticado",
        });
      }

      const user = await UserRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        return response.status(404).json({
          message: "Usuário não encontrado",
        });
      }

      return response.status(200).json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      });
    } catch {
      return response.status(500).json({
        message: "Erro interno do servidor",
      });
    }
  }
}