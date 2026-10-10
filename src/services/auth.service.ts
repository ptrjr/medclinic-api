import type { LoginInput } from '../dtos/auth.dto';
import { AppError } from '../errors/app-error';
import type { UserRepositoryPort } from '../ports/user-repository.port';
import type { PasswordHasherPort } from '../ports/password-hasher.port';
import type { TokenProviderPort } from '../ports/token-provider.port';

export class AuthService {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly passwords: PasswordHasherPort,
    private readonly tokens: TokenProviderPort,
  ) {}

  public async login(input: LoginInput): Promise<{ accessToken: string }> {
    const user = await this.users.findByEmail(input.email);
    if (!user || !(await this.passwords.compare(input.password, user.passwordHash))) {
      throw new AppError('CREDENCIAIS_INVALIDAS', 'Credenciais inválidas.');
    }
    return { accessToken: this.tokens.sign({ id: user.id, roles: [...user.roles] }) };
  }
}
