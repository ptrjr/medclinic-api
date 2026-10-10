import type { Request, Response } from 'express';
import { createUserSchema } from '../dtos/auth.dto';
import { AppError } from '../errors/app-error';
import type { UserService } from '../services/user.service';

export class UserController {
  constructor(private readonly users: UserService) {}

  public async me(request: Request, response: Response): Promise<void> {
    if (!request.user) throw new AppError('NAO_AUTENTICADO', 'Usuário não autenticado.');
    response.status(200).json(await this.users.me(request.user.id));
  }

  public async create(request: Request, response: Response): Promise<void> {
    if (!request.user) throw new AppError('NAO_AUTENTICADO', 'Usuário não autenticado.');
    const input = createUserSchema.parse(request.body as unknown);
    response.status(201).json(await this.users.create(input, request.user));
  }
}
