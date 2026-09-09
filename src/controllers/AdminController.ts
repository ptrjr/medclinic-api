import { Request, Response } from "express";

export class AdminController {
  async ping(request: Request, response: Response) {
    return response.status(200).json({
      message: "Acesso de administrador autorizado",
    });
  }
}