import { describe, expect, it } from 'vitest';
import { AuthService } from '../src/services/auth.service';
import { account, createDoubles } from './doubles';

describe('Autenticação', () => {
  it('compara a senha com o hash armazenado e retorna accessToken', async () => {
    const { users, passwords, tokens } = createDoubles();
    users.findByEmail.mockResolvedValue(account);
    const result = await new AuthService(users, passwords, tokens).login({
      email: account.email,
      password: 'SenhaForte@123',
    });
    expect(passwords.compare).toHaveBeenCalledWith('SenhaForte@123', account.passwordHash);
    expect(tokens.sign).toHaveBeenCalledWith({ id: account.id, roles: account.roles });
    expect(result).toEqual({ accessToken: 'token-de-teste' });
    expect(result).not.toHaveProperty('password');
  });

  it('recusa e-mail inexistente sem emitir token', async () => {
    const { users, passwords, tokens } = createDoubles();
    await expect(
      new AuthService(users, passwords, tokens).login({
        email: 'missing@example.com',
        password: 'qualquer-senha',
      }),
    ).rejects.toMatchObject({ code: 'CREDENCIAIS_INVALIDAS' });
    expect(tokens.sign).not.toHaveBeenCalled();
  });

  it('recusa senha incorreta com o mesmo erro do e-mail inexistente', async () => {
    const { users, passwords, tokens } = createDoubles();
    users.findByEmail.mockResolvedValue(account);
    passwords.compare.mockResolvedValue(false);
    await expect(
      new AuthService(users, passwords, tokens).login({
        email: account.email,
        password: 'senha-incorreta',
      }),
    ).rejects.toMatchObject({ code: 'CREDENCIAIS_INVALIDAS' });
    expect(tokens.sign).not.toHaveBeenCalled();
  });

  it('propaga falhas inesperadas para o tratamento central', async () => {
    const { users, passwords, tokens } = createDoubles();
    const failure = new Error('Falha de armazenamento');
    users.findByEmail.mockRejectedValue(failure);
    await expect(
      new AuthService(users, passwords, tokens).login({
        email: account.email,
        password: 'senha',
      }),
    ).rejects.toBe(failure);
  });
});
