import { randomUUID } from 'node:crypto';
import { QueryFailedError, type Repository } from 'typeorm';
import { UserRole, type NewUserAccount, type UserAccount } from '../domain/user';
import { UserEntity } from '../entities/user.entity';
import { AppError } from '../errors/app-error';
import type { UserRepositoryPort } from '../ports/user-repository.port';

export class TypeOrmUserRepository implements UserRepositoryPort {
  constructor(private readonly users: Repository<UserEntity>) {}

  public async findByEmail(email: string): Promise<UserAccount | null> {
    const user = await this.users.findOneBy({ email });
    return user ? this.toAccount(user) : null;
  }

  public async findById(id: string): Promise<UserAccount | null> {
    const user = await this.users.findOneBy({ id });
    return user ? this.toAccount(user) : null;
  }

  public async createUser(input: NewUserAccount): Promise<UserAccount> {
    try {
      const user = this.users.create({ id: randomUUID(), ...input });
      return this.toAccount(await this.users.save(user));
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError: unknown = error.driverError;
        if (
          typeof driverError === 'object' &&
          driverError !== null &&
          'code' in driverError &&
          driverError.code === '23505'
        ) {
          throw new AppError('EMAIL_JA_CADASTRADO', 'E-mail já cadastrado.');
        }
      }
      throw error;
    }
  }

  private toAccount(user: UserEntity): UserAccount {
    // O CHECK da migration também garante que não existam perfis desconhecidos no banco.
    const roles = user.roles.filter((role) => Object.values(UserRole).includes(role));
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roles,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt,
    };
  }
}
