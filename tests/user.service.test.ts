import { describe, expect, it } from 'vitest';
import { UserRole } from '../src/domain/user';
import { AppError } from '../src/errors/app-error';
import { UserService } from '../src/services/user.service';
import { account, admin, createDoubles } from './doubles';

const input = {
  name: 'Joana',
  email: 'joana@example.com',
  password: 'SenhaForte@123',
  roles: [UserRole.SECRETARY],
};

describe('Usuários e autorização', () => {
  it('consulta o perfil pelo service e nunca retorna a senha', async () => {
    const { users, passwords } = createDoubles();
    users.findById.mockResolvedValue(account);
    const result = await new UserService(users, passwords).me(account.id);
    expect(users.findById).toHaveBeenCalledWith(account.id);
    expect(result).toEqual({
      id: account.id,
      name: account.name,
      email: account.email,
      roles: ['admin'],
    });
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('informa quando o usuário não existe', async () => {
    const { users, passwords } = createDoubles();
    await expect(new UserService(users, passwords).me(account.id)).rejects.toMatchObject({
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  });

  it('admin cria usuário com hash e DTO sem senha', async () => {
    const { users, passwords } = createDoubles();
    const result = await new UserService(users, passwords).create(input, admin);
    expect(passwords.hash).toHaveBeenCalledWith(input.password);
    expect(users.createUser).toHaveBeenCalledWith({
      name: input.name,
      email: input.email,
      passwordHash: 'hash-gerado',
      roles: ['secretary'],
    });
    expect(result.roles).toEqual(['secretary']);
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('password');
  });

  it.each([UserRole.SECRETARY, UserRole.DOCTOR])('%s não pode criar outro admin', async (role) => {
    const { users, passwords } = createDoubles();
    await expect(
      new UserService(users, passwords).create(
        { ...input, roles: [UserRole.ADMIN] },
        { id: account.id, roles: [role] },
      ),
    ).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
    expect(users.createUser).not.toHaveBeenCalled();
    expect(passwords.hash).not.toHaveBeenCalled();
  });

  it('admin autenticado pode criar outro admin e remover perfis repetidos', async () => {
    const { users, passwords } = createDoubles();
    const result = await new UserService(users, passwords).create(
      { ...input, roles: [UserRole.ADMIN, UserRole.ADMIN, UserRole.SECRETARY] },
      admin,
    );
    expect(result.roles).toEqual(['admin', 'secretary']);
  });

  it('recusa e-mail duplicado antes de persistir', async () => {
    const { users, passwords } = createDoubles();
    users.findByEmail.mockResolvedValue(account);
    await expect(new UserService(users, passwords).create(input, admin)).rejects.toMatchObject({
      code: 'EMAIL_JA_CADASTRADO',
    });
    expect(users.createUser).not.toHaveBeenCalled();
  });

  it('preserva o erro de unicidade quando outra gravação ganha a corrida', async () => {
    const { users, passwords } = createDoubles();
    users.createUser.mockRejectedValue(new AppError('EMAIL_JA_CADASTRADO', 'E-mail duplicado.'));
    await expect(new UserService(users, passwords).create(input, admin)).rejects.toMatchObject({
      code: 'EMAIL_JA_CADASTRADO',
    });
  });
});
