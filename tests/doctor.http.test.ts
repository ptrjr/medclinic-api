import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DoctorController } from '../src/controllers/doctor.controller';
import { UserRole } from '../src/domain/user';
import { AppError } from '../src/errors/app-error';
import { JwtTokenProvider } from '../src/infrastructure/jwt-token-provider';
import { createAuthMiddleware } from '../src/middlewares/auth.middleware';
import { createErrorMiddleware } from '../src/middlewares/error.middleware';
import { createDoctorRoutes } from '../src/routes/doctor.routes';
import { DoctorService } from '../src/services/doctor.service';
import { admin } from './doubles';
import { createDoctorDoubles, doctor, doctorInput } from './doctor-doubles';

const doubles = createDoctorDoubles();
const tokens = new JwtTokenProvider('segredo-ficticio-de-teste-http-de-medicos', 3600);
let server: Server;
let base: string;

async function call(
  path: string,
  options: { method?: string; body?: unknown; role?: UserRole; anonymous?: boolean } = {},
) {
  const headers: Record<string, string> = {};
  if (!options.anonymous)
    headers.Authorization = `Bearer ${tokens.sign({ id: admin.id, roles: [options.role ?? UserRole.ADMIN] })}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}/api/v1/doctors${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: response.status, body: await response.json() };
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  const controller = new DoctorController(
    new DoctorService(doubles.doctors, doubles.users, doubles.passwords),
  );
  app.use('/api/v1/doctors', createDoctorRoutes(controller, createAuthMiddleware(tokens)));
  app.use(createErrorMiddleware(vi.fn()));
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Porta do teste indisponível');
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
beforeEach(() => {
  vi.clearAllMocks();
  doubles.doctors.findByCrm.mockResolvedValue(null);
  doubles.doctors.findById.mockResolvedValue(doctor);
  doubles.doctors.createWithUser.mockResolvedValue(doctor);
  doubles.users.findByEmail.mockResolvedValue(null);
});

describe('Contrato HTTP de Médicos', () => {
  it.each(['', `/${doctor.id}`])('exige token para consulta %s', async (path) => {
    const result = await call(path, { anonymous: true });
    expect(result).toMatchObject({
      status: 401,
      body: { statusCode: 401, error: 'NAO_AUTENTICADO' },
    });
  });
  it('cadastro anônimo devolve 401', async () => {
    expect(await call('', { method: 'POST', body: doctorInput, anonymous: true })).toMatchObject({
      status: 401,
    });
  });
  it.each([UserRole.SECRETARY, UserRole.DOCTOR])('%s não cadastra médico', async (role) => {
    expect(await call('', { method: 'POST', body: doctorInput, role })).toMatchObject({
      status: 403,
      body: { error: 'ACESSO_NEGADO' },
    });
    expect(doubles.doctors.createWithUser).not.toHaveBeenCalled();
  });
  it('admin recebe 201 com user aninhado e perfil doctor', async () => {
    const result = await call('', { method: 'POST', body: doctorInput });
    expect(result).toEqual({
      status: 201,
      body: {
        id: doctor.id,
        crm: doctor.crm,
        user: {
          id: doctor.user.id,
          name: doctor.user.name,
          email: doctor.user.email,
          roles: ['doctor'],
        },
      },
    });
  });
  it.each([
    {},
    { ...doctorInput, crm: '' },
    { ...doctorInput, email: 'aaa' },
    { ...doctorInput, password: '123' },
    { ...doctorInput, roles: ['admin'] },
  ])('corpo inválido retorna 400 antes de gravar: %j', async (body) => {
    expect(await call('', { method: 'POST', body })).toMatchObject({
      status: 400,
      body: { error: 'DADOS_INVALIDOS' },
    });
    expect(doubles.doctors.createWithUser).not.toHaveBeenCalled();
  });
  it.each(['CRM_JA_CADASTRADO', 'EMAIL_JA_CADASTRADO'] as const)(
    'traduz %s para 409',
    async (code) => {
      doubles.doctors.createWithUser.mockRejectedValue(new AppError(code, 'Duplicado.'));
      expect(await call('', { method: 'POST', body: doctorInput })).toMatchObject({
        status: 409,
        body: { statusCode: 409, error: code },
      });
    },
  );
  it.each([UserRole.ADMIN, UserRole.SECRETARY, UserRole.DOCTOR])(
    '%s pode listar e consultar',
    async (role) => {
      expect(await call('', { role })).toEqual({
        status: 200,
        body: {
          data: [
            {
              id: doctor.id,
              crm: doctor.crm,
              user: {
                id: doctor.user.id,
                name: doctor.user.name,
                email: doctor.user.email,
                roles: ['doctor'],
              },
            },
          ],
          meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
        },
      });
      expect((await call(`/${doctor.id}`, { role })).status).toBe(200);
    },
  );
  it('aceita page, pageSize e name da URL e repassa o filtro por nome', async () => {
    const result = await call('?page=2&pageSize=5&name=Helena');
    expect(result.body.meta).toMatchObject({ page: 2, pageSize: 5 });
    expect(doubles.doctors.list).toHaveBeenCalledWith({ page: 2, pageSize: 5, name: 'Helena' });
  });
  it.each([
    'page=0',
    'page=-1',
    'page=1.5',
    'page=abc',
    'page=',
    'pageSize=0',
    'pageSize=101',
    'pageSize=abc',
    'pageSize=',
    'pageSize=2&pageSize=3',
  ])('recusa paginação inválida %s', async (query) => {
    expect(await call(`?${query}`)).toMatchObject({
      status: 400,
      body: { error: 'DADOS_INVALIDOS' },
    });
    expect(doubles.doctors.list).not.toHaveBeenCalled();
  });
  it('ID malformado retorna 400; UUID inexistente retorna 404', async () => {
    expect(await call('/invalid')).toMatchObject({
      status: 400,
      body: { error: 'DADOS_INVALIDOS' },
    });
    doubles.doctors.findById.mockResolvedValue(null);
    expect(await call(`/${doctor.id}`)).toMatchObject({
      status: 404,
      body: { error: 'RECURSO_NAO_ENCONTRADO' },
    });
  });
});
