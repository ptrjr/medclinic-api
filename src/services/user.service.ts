import { UserRole, type AuthPrincipal } from '../domain/user';
import { toUserResponse, type CreateUserInput, type UserResponse } from '../dtos/auth.dto';
import { AppError } from '../errors/app-error';
import type { UserRepositoryPort } from '../ports/user-repository.port';
import type { PasswordHasherPort } from '../ports/password-hasher.port';

export class UserService {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly passwords: PasswordHasherPort,
  ) {}

  public async me(id: string): Promise<UserResponse> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new AppError('RECURSO_NAO_ENCONTRADO', 'Usuário não encontrado.');
    }
    return toUserResponse(user);
  }

  public async create(input: CreateUserInput, actor: AuthPrincipal): Promise<UserResponse> {
    if (!actor.roles.includes(UserRole.ADMIN)) {
      throw new AppError('ACESSO_NEGADO', 'Apenas administradores podem criar usuários.');
    }
    if (await this.users.findByEmail(input.email)) {
      throw new AppError('EMAIL_JA_CADASTRADO', 'E-mail já cadastrado.');
    }
    const user = await this.users.createUser({
      name: input.name,
      email: input.email,
      passwordHash: await this.passwords.hash(input.password),
      roles: [...new Set(input.roles)],
    });
    return toUserResponse(user);
  }
}
