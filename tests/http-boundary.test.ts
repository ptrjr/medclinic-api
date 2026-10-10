import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { AuthController } from '../src/controllers/auth.controller';
import { UserController } from '../src/controllers/user.controller';
import { loginSchema } from '../src/dtos/auth.dto';
import { UserRole } from '../src/domain/user';
import { AppError, type ErrorCode } from '../src/errors/app-error';
import { createAuthMiddleware } from '../src/middlewares/auth.middleware';
import { createErrorMiddleware } from '../src/middlewares/error.middleware';
import { requireRoles } from '../src/middlewares/role.middleware';
import { AuthService } from '../src/services/auth.service';
import { UserService } from '../src/services/user.service';
import { admin, account, createDoubles } from './doubles';

function request(fields: Partial<Request> = {}): Request {
  return { headers: {}, ...fields } as Request;
}
function response() {
  const value = {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return { value, res: value as unknown as Response };
}

describe('Autenticação e RBAC na borda HTTP', () => {
  it.each([undefined, '', 'Basic token', 'Bearer', 'Bearer a b', 'Bearer  token'])(
    'recusa cabeçalho ausente ou malformado: %s',
    (authorization) => {
      const { tokens } = createDoubles();
      expect(() =>
        createAuthMiddleware(tokens)(
          request({ headers: { authorization } }),
          response().res,
          vi.fn(),
        ),
      ).toThrow('Token ausente ou malformado.');
      expect(tokens.verify).not.toHaveBeenCalled();
    },
  );

  it('verifica o token e injeta o usuário antes de continuar', () => {
    const { tokens } = createDoubles();
    const req = request({ headers: { authorization: 'Bearer token' } });
    const next = vi.fn();
    createAuthMiddleware(tokens)(req, response().res, next);
    expect(tokens.verify).toHaveBeenCalledWith('token');
    expect(req.user).toEqual(admin);
    expect(next).toHaveBeenCalledOnce();
  });

  it('envia a falha de token para o único caminho de erro', () => {
    const { tokens } = createDoubles();
    const failure = new AppError('NAO_AUTENTICADO', 'Token inválido.');
    tokens.verify.mockImplementation(() => {
      throw failure;
    });
    expect(() =>
      createAuthMiddleware(tokens)(
        request({ headers: { authorization: 'Bearer token' } }),
        response().res,
        vi.fn(),
      ),
    ).toThrow(failure);
  });

  it('RBAC recusa falta de autenticação', () => {
    expect(() => requireRoles(UserRole.ADMIN)(request(), response().res, vi.fn())).toThrow(
      'Usuário não autenticado.',
    );
  });

  it('RBAC recusa o perfil secretary em rota administrativa', () => {
    expect(() =>
      requireRoles(UserRole.ADMIN)(
        request({ user: { id: admin.id, roles: [UserRole.SECRETARY] } }),
        response().res,
        vi.fn(),
      ),
    ).toThrow('Perfil sem permissão');
  });

  it('RBAC admite admin entre múltiplos perfis', () => {
    const next = vi.fn();
    requireRoles(UserRole.ADMIN)(
      request({ user: { id: admin.id, roles: [UserRole.SECRETARY, UserRole.ADMIN] } }),
      response().res,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('Envelope único de erro', () => {
  const cases: [ErrorCode, number][] = [
    ['DADOS_INVALIDOS', 400],
    ['NAO_AUTENTICADO', 401],
    ['CREDENCIAIS_INVALIDAS', 401],
    ['ACESSO_NEGADO', 403],
    ['RECURSO_NAO_ENCONTRADO', 404],
    ['EMAIL_JA_CADASTRADO', 409],
    ['CPF_JA_CADASTRADO', 409],
    ['CRM_JA_CADASTRADO', 409],
    ['HORARIO_INDISPONIVEL', 409],
    ['PACIENTE_INDISPONIVEL', 409],
    ['HORARIO_FORA_DA_ESCALA', 422],
    ['TRANSICAO_INVALIDA', 422],
  ];

  it.each(cases)('traduz %s para status %i', (code, statusCode) => {
    const { value, res } = response();
    const log = vi.fn();
    createErrorMiddleware(log)(new AppError(code, 'Mensagem'), request(), res, vi.fn());
    expect(value.status).toHaveBeenCalledWith(statusCode);
    expect(value.json).toHaveBeenCalledWith({ statusCode, error: code, message: 'Mensagem' });
    expect(log).not.toHaveBeenCalled();
  });

  it('validação Zod retorna 400, sem vazar o corpo ou senha', () => {
    const parsed = loginSchema.safeParse({ email: 'aaa' });
    if (parsed.success) throw new Error('Fixture deveria falhar');
    const { value, res } = response();
    createErrorMiddleware(vi.fn())(parsed.error, request(), res, vi.fn());
    expect(value.status).toHaveBeenCalledWith(400);
    expect(value.json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'DADOS_INVALIDOS',
      message: 'Dados de entrada inválidos.',
    });
  });

  it.each(['entity.parse.failed', 'entity.too.large'])(
    'trata erro de JSON %s no envelope',
    (type) => {
      const { value, res } = response();
      createErrorMiddleware(vi.fn())({ type }, request(), res, vi.fn());
      expect(value.status).toHaveBeenCalledWith(400);
      expect(value.json.mock.calls[0][0]).toMatchObject({
        error: 'DADOS_INVALIDOS',
        statusCode: 400,
      });
    },
  );

  it('registra erro inesperado e devolve 500 genérico', () => {
    const { value, res } = response();
    const log = vi.fn();
    const error = new Error('Falha com detalhes internos');
    createErrorMiddleware(log)(error, request(), res, vi.fn());
    expect(log).toHaveBeenCalledWith(error);
    expect(value.status).toHaveBeenCalledWith(500);
    expect(value.json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'ERRO_INTERNO',
      message: 'Erro interno do servidor.',
    });
  });

  it('não escreve uma segunda resposta quando os cabeçalhos já foram enviados', () => {
    const { value, res } = response();
    value.headersSent = true;
    const next = vi.fn();
    const error = new Error('Falha');
    createErrorMiddleware(vi.fn())(error, request(), res, next);
    expect(next).toHaveBeenCalledWith(error);
    expect(value.json).not.toHaveBeenCalled();
  });
});

describe('Controllers sem try/catch ou consulta direta ao TypeORM', () => {
  it('UserController.me deixa a Promise rejeitada chegar ao Express 5', async () => {
    const { users, passwords } = createDoubles();
    const error = new Error('Falha de armazenamento');
    users.findById.mockRejectedValue(error);
    const controller = new UserController(new UserService(users, passwords));
    await expect(controller.me(request({ user: admin }), response().res)).rejects.toBe(error);
  });

  it('AuthController valida a entrada antes de chamar a autenticação', async () => {
    const { users, passwords, tokens } = createDoubles();
    const controller = new AuthController(new AuthService(users, passwords, tokens));
    await expect(
      controller.login(request({ body: { email: 'aaa', password: 'senha' } }), response().res),
    ).rejects.toThrow();
    expect(users.findByEmail).not.toHaveBeenCalled();
  });

  it('UserController.create recusa role inválido antes de acessar o repositório', async () => {
    const { users, passwords } = createDoubles();
    const controller = new UserController(new UserService(users, passwords));
    await expect(
      controller.create(
        request({
          user: admin,
          body: {
            name: 'Joana',
            email: account.email,
            password: 'SenhaForte@123',
            roles: ['Gerente'],
          },
        }),
        response().res,
      ),
    ).rejects.toThrow();
    expect(users.createUser).not.toHaveBeenCalled();
  });
});
