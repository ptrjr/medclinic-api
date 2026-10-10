import { describe, expect, it } from 'vitest';
import { UserRole } from '../src/domain/user';
import { AdminSeedService } from '../src/services/admin-seed.service';
import { account, createDoubles } from './doubles';

const input = { name: account.name, email: account.email, password: 'SenhaForte@123' };

describe('Administrador inicial', () => {
  it('cria o admin com senha em hash', async () => {
    const { users, passwords } = createDoubles();
    await expect(new AdminSeedService(users, passwords).execute(input)).resolves.toBe('created');
    expect(users.createUser).toHaveBeenCalledWith({
      name: input.name,
      email: input.email,
      passwordHash: 'hash-gerado',
      roles: ['admin'],
    });
  });

  it('é idempotente e preserva a senha de um admin existente', async () => {
    const { users, passwords } = createDoubles();
    users.findByEmail.mockResolvedValue(account);
    await expect(new AdminSeedService(users, passwords).execute(input)).resolves.toBe('exists');
    expect(users.createUser).not.toHaveBeenCalled();
    expect(passwords.hash).not.toHaveBeenCalled();
  });

  it('não promove um usuário existente automaticamente', async () => {
    const { users, passwords } = createDoubles();
    users.findByEmail.mockResolvedValue({ ...account, roles: [UserRole.SECRETARY] });
    await expect(new AdminSeedService(users, passwords).execute(input)).rejects.toMatchObject({
      code: 'EMAIL_JA_CADASTRADO',
    });
    expect(users.createUser).not.toHaveBeenCalled();
  });
});
