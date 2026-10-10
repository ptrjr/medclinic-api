import { vi } from 'vitest';
import { UserRole, type UserAccount } from '../src/domain/user';
import type { PasswordHasherPort } from '../src/ports/password-hasher.port';
import type { TokenProviderPort } from '../src/ports/token-provider.port';
import type { UserRepositoryPort } from '../src/ports/user-repository.port';

export const admin = { id: '20ba7288-1e53-4d79-8a38-4446c4840c28', roles: [UserRole.ADMIN] };
export const account: UserAccount = {
  ...admin,
  name: 'Administrador',
  email: 'admin@example.com',
  passwordHash: 'hash-fornecido-pelo-repositorio',
  createdAt: new Date('2026-10-10T12:00:00Z'),
};

export function createDoubles() {
  const users = {
    findByEmail: vi.fn<UserRepositoryPort['findByEmail']>().mockResolvedValue(null),
    findById: vi.fn<UserRepositoryPort['findById']>().mockResolvedValue(null),
    createUser: vi.fn<UserRepositoryPort['createUser']>().mockImplementation(async (input) => ({
      ...input,
      id: account.id,
      createdAt: account.createdAt,
    })),
  };
  const passwords = {
    hash: vi.fn<PasswordHasherPort['hash']>().mockResolvedValue('hash-gerado'),
    compare: vi.fn<PasswordHasherPort['compare']>().mockResolvedValue(true),
  };
  const tokens = {
    sign: vi.fn<TokenProviderPort['sign']>().mockReturnValue('token-de-teste'),
    verify: vi.fn<TokenProviderPort['verify']>().mockReturnValue(admin),
  };
  return { users, passwords, tokens };
}
