import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { BcryptPasswordHasher } from '../src/infrastructure/bcrypt-password-hasher';
import { JwtTokenProvider } from '../src/infrastructure/jwt-token-provider';
import { admin } from './doubles';

const secret = 'segredo-local-exclusivo-dos-testes-unitarios';

describe('Hash de senha real', () => {
  it('armazena hash bcrypt e distingue senhas corretas e incorretas', async () => {
    const hasher = new BcryptPasswordHasher();
    const hash = await hasher.hash('SenhaForte@123');
    expect(hash).not.toBe('SenhaForte@123');
    expect(hash).toMatch(/^\$2[aby]\$/);
    await expect(hasher.compare('SenhaForte@123', hash)).resolves.toBe(true);
    await expect(hasher.compare('senha-incorreta', hash)).resolves.toBe(false);
  });
});

describe('JWT real', () => {
  it('carrega identificador, perfis e expiração', () => {
    const tokens = new JwtTokenProvider(secret, 3600);
    const token = tokens.sign(admin);
    expect(tokens.verify(token)).toEqual(admin);
    const decoded = jwt.decode(token);
    expect(decoded).toMatchObject({ sub: admin.id, roles: ['admin'] });
    expect(typeof decoded === 'object' && decoded !== null && 'exp' in decoded).toBe(true);
  });

  it('recusa token expirado', () => {
    const tokens = new JwtTokenProvider(secret, -1);
    expect(() => tokens.verify(tokens.sign(admin))).toThrow('Token inválido ou expirado.');
  });

  it('recusa assinatura de outro segredo', () => {
    const token = new JwtTokenProvider(secret + '-outro', 3600).sign(admin);
    expect(() => new JwtTokenProvider(secret, 3600).verify(token)).toThrow(
      'Token inválido ou expirado.',
    );
  });

  it.each([
    { roles: ['Gerente'], sub: admin.id },
    { roles: ['admin'], sub: 'id-invalido' },
    { sub: admin.id },
  ])('recusa payload que não representa um usuário do contrato', (payload) => {
    const token = jwt.sign(payload, secret, {
      issuer: 'medclinic-api',
      audience: 'medclinic-api',
      expiresIn: 3600,
    });
    expect(() => new JwtTokenProvider(secret, 3600).verify(token)).toThrow(
      'Token inválido ou expirado.',
    );
  });

  it('recusa algoritmo diferente do configurado', () => {
    const token = jwt.sign({ roles: admin.roles }, secret, {
      subject: admin.id,
      issuer: 'medclinic-api',
      audience: 'medclinic-api',
      algorithm: 'HS512',
      expiresIn: 3600,
    });
    expect(() => new JwtTokenProvider(secret, 3600).verify(token)).toThrow(
      'Token inválido ou expirado.',
    );
  });
});
