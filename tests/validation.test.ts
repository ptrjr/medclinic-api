import { describe, expect, it } from 'vitest';
import { createUserSchema, loginSchema, passwordSchema } from '../src/dtos/auth.dto';
import {
  parseAdminEnvironment,
  parseAppEnvironment,
  parseDatabaseEnvironment,
} from '../src/config/environment';

const userInput = {
  name: 'Joana',
  email: 'joana@example.com',
  password: 'SenhaForte@123',
  roles: ['secretary'],
};
const environment = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'senha-de-teste',
  DB_DATABASE: 'medclinic',
  DB_SSL: 'false',
  JWT_SECRET: 'segredo-apenas-para-testes-unitarios',
  JWT_EXPIRES_IN: '1d',
};

describe('Validação de entrada', () => {
  it.each(['aaa', 'nome@', '@example.com', 'nome@example'])(
    'rejeita e-mail inválido %s',
    (email) => {
      expect(createUserSchema.safeParse({ ...userInput, email }).success).toBe(false);
    },
  );

  it('normaliza o e-mail e remove espaços do nome', () => {
    expect(
      createUserSchema.parse({ ...userInput, name: ' Joana ', email: ' JOANA@EXAMPLE.COM ' }),
    ).toMatchObject({ name: 'Joana', email: 'joana@example.com' });
  });

  it.each([['Gerente'], [], 'admin', ['Administrador']])(
    'rejeita perfil fora do contrato: %j',
    (roles) => {
      expect(createUserSchema.safeParse({ ...userInput, roles }).success).toBe(false);
    },
  );

  it('rejeita o campo singular role da API anterior', () => {
    expect(createUserSchema.safeParse({ ...userInput, role: 'Administrador' }).success).toBe(false);
  });

  it('aceita os três perfis do contrato', () => {
    expect(
      createUserSchema.parse({ ...userInput, roles: ['admin', 'secretary', 'doctor'] }).roles,
    ).toEqual(['admin', 'secretary', 'doctor']);
  });

  it.each([{}, { email: userInput.email }, { password: userInput.password }])(
    'rejeita login incompleto',
    (body) => {
      expect(loginSchema.safeParse(body).success).toBe(false);
    },
  );

  it('não corta nem normaliza a senha', () => {
    expect(
      loginSchema.parse({ email: userInput.email, password: ' senha com espaços ' }).password,
    ).toBe(' senha com espaços ');
  });

  it('rejeita nome vazio, senha curta e senha maior que 72 bytes', () => {
    expect(createUserSchema.safeParse({ ...userInput, name: ' ' }).success).toBe(false);
    expect(passwordSchema.safeParse('123').success).toBe(false);
    expect(passwordSchema.safeParse('á'.repeat(37)).success).toBe(false);
    expect(passwordSchema.safeParse('a'.repeat(72)).success).toBe(true);
  });
});

describe('Configuração validada antes do boot', () => {
  it('converte porta, SSL e duração sem casts para esconder valores inválidos', () => {
    expect(
      parseAppEnvironment({ ...environment, DB_SSL: 'true', JWT_EXPIRES_IN: '2h' }),
    ).toMatchObject({ PORT: 3000, DB_PORT: 5432, DB_SSL: true, JWT_EXPIRES_IN: 7200 });
  });

  it('permite migrations sem exigir JWT ou credenciais do seed', () => {
    expect(parseDatabaseEnvironment(environment).DB_DATABASE).toBe('medclinic');
  });

  it('falha claramente quando JWT_SECRET está ausente', () => {
    expect(() => parseAppEnvironment({ ...environment, JWT_SECRET: undefined })).toThrow(
      'JWT_SECRET',
    );
  });

  it.each([
    { DB_PORT: 'abc' },
    { DB_PORT: '0' },
    { PORT: '70000' },
    { JWT_EXPIRES_IN: '0d' },
    { JWT_EXPIRES_IN: 'qualquer' },
    { DB_SSL: 'talvez' },
    { DB_HOST: '' },
  ])('recusa configuração inválida: %j', (invalid) => {
    expect(() => parseAppEnvironment({ ...environment, ...invalid })).toThrow(
      'Configuração inválida',
    );
  });

  it('valida as credenciais do seed e normaliza o e-mail', () => {
    expect(
      parseAdminEnvironment({
        ADMIN_EMAIL: ' ADMIN@EXAMPLE.COM ',
        ADMIN_PASSWORD: 'SenhaForte@123',
      }),
    ).toMatchObject({ ADMIN_NAME: 'Administrador', ADMIN_EMAIL: 'admin@example.com' });
    expect(() => parseAdminEnvironment({ ADMIN_EMAIL: 'aaa' })).toThrow('ADMIN_EMAIL');
  });

  it('não imprime os valores dos segredos ao falhar', () => {
    const secret = 'valor-curto';
    expect(() => parseAppEnvironment({ ...environment, JWT_SECRET: secret })).toThrow(
      'Configuração inválida. Confira as variáveis: JWT_SECRET.',
    );
  });
});
