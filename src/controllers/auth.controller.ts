import type { Request, Response } from 'express';
import { loginSchema } from '../dtos/auth.dto';
import type { AuthService } from '../services/auth.service';

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  public async login(request: Request, response: Response): Promise<void> {
    const input = loginSchema.parse(request.body as unknown);
    response.status(200).json(await this.auth.login(input));
  }
}
