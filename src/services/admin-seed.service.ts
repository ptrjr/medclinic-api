import { UserRole } from '../domain/user';
import { AppError } from '../errors/app-error';
import type { PasswordHasherPort } from '../ports/password-hasher.port';
import type { UserRepositoryPort } from '../ports/user-repository.port';

export interface AdminSeedInput {
  name: string;
  email: string;
  password: string;
}

export class AdminSeedService {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly passwords: PasswordHasherPort,
  ) {}

  public async execute(input: AdminSeedInput): Promise<'created' | 'exists'> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      if (!existing.roles.includes(UserRole.ADMIN)) {
        throw new AppError(
          'EMAIL_JA_CADASTRADO',
          'O e-mail do seed já pertence a um usuário sem perfil admin.',
        );
      }
      return 'exists';
    }
    await this.users.createUser({
      name: input.name,
      email: input.email,
      passwordHash: await this.passwords.hash(input.password),
      roles: [UserRole.ADMIN],
    });
    return 'created';
  }
}
