import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientController } from '../src/controllers/patient.controller';
import { UserRole } from '../src/domain/user';
import { AppError } from '../src/errors/app-error';
import { JwtTokenProvider } from '../src/infrastructure/jwt-token-provider';
import { createAuthMiddleware } from '../src/middlewares/auth.middleware';
import { createErrorMiddleware } from '../src/middlewares/error.middleware';
import { createPatientRoutes } from '../src/routes/patient.routes';
import { PatientService } from '../src/services/patient.service';
import { admin } from './doubles';
import { createPatientDoubles, patient, patientResponse } from './patient-doubles';

const patients = createPatientDoubles();
const tokens = new JwtTokenProvider('segredo-ficticio-de-teste-http-de-pacientes', 3600);
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
  const response = await fetch(`${base}/api/v1/patients${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return {
    status: response.status,
    body: response.status === 204 ? await response.text() : await response.json(),
  };
}
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/patients',
    createPatientRoutes(
      new PatientController(new PatientService(patients)),
      createAuthMiddleware(tokens),
    ),
  );
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
  patients.findById.mockResolvedValue(patient);
  patients.findByCpf.mockResolvedValue(null);
  patients.create.mockResolvedValue(patient);
  patients.update.mockResolvedValue(patient);
  patients.delete.mockResolvedValue(true);
  patients.list.mockResolvedValue({ items: [patient], total: 1 });
});

describe('Contrato HTTP literal de Pacientes', () => {
  it.each([
    ['GET', ''],
    ['GET', `/${patient.id}`],
    ['POST', ''],
    ['PATCH', `/${patient.id}`],
    ['DELETE', `/${patient.id}`],
  ])('%s %s exige token', async (method, path) => {
    expect(await call(path, { method, anonymous: true })).toMatchObject({
      status: 401,
      body: { statusCode: 401, error: 'NAO_AUTENTICADO' },
    });
  });
  it.each([UserRole.ADMIN, UserRole.SECRETARY])(
    '%s cadastra com apenas name/cpf do enunciado',
    async (role) => {
      expect(
        await call('', { method: 'POST', body: { name: patient.name, cpf: '12345678901' }, role }),
      ).toEqual({ status: 201, body: patientResponse });
      expect(patients.create).toHaveBeenCalledWith({ name: patient.name, cpf: '12345678901' });
    },
  );
  it('doctor não cadastra', async () => {
    expect(await call('', { method: 'POST', body: patient, role: UserRole.DOCTOR })).toMatchObject({
      status: 403,
      body: { error: 'ACESSO_NEGADO' },
    });
    expect(patients.create).not.toHaveBeenCalled();
  });
  it.each([
    undefined,
    '',
    '123',
    '123456789012',
    '123.456.789-01',
    '1234567890a',
    ' 12345678901',
    '12345678901 ',
    12345678901,
  ])('CPF fora do formato retorna 400: %s', async (cpf) => {
    expect(await call('', { method: 'POST', body: { name: patient.name, cpf } })).toMatchObject({
      status: 400,
      body: { error: 'DADOS_INVALIDOS' },
    });
    expect(patients.create).not.toHaveBeenCalled();
  });
  it.each([undefined, '', '   ', 123])('name inválido retorna 400: %s', async (name) => {
    expect(await call('', { method: 'POST', body: { name, cpf: patient.cpf } })).toMatchObject({
      status: 400,
      body: { error: 'DADOS_INVALIDOS' },
    });
    expect(patients.create).not.toHaveBeenCalled();
  });
  it('CPF duplicado retorna o envelope 409', async () => {
    patients.findByCpf.mockResolvedValue(patient);
    expect(
      await call('', { method: 'POST', body: { name: patient.name, cpf: patient.cpf } }),
    ).toMatchObject({ status: 409, body: { statusCode: 409, error: 'CPF_JA_CADASTRADO' } });
  });
  it('conflito concorrente também retorna 409', async () => {
    patients.create.mockRejectedValue(new AppError('CPF_JA_CADASTRADO', 'CPF repetido.'));
    expect(
      await call('', { method: 'POST', body: { name: patient.name, cpf: patient.cpf } }),
    ).toMatchObject({ status: 409, body: { error: 'CPF_JA_CADASTRADO' } });
  });
  it.each([UserRole.ADMIN, UserRole.SECRETARY, UserRole.DOCTOR])(
    '%s lê lista e detalhe',
    async (role) => {
      expect(await call('', { role })).toEqual({
        status: 200,
        body: { data: [patientResponse], meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 } },
      });
      expect(await call(`/${patient.id}`, { role })).toEqual({
        status: 200,
        body: patientResponse,
      });
    },
  );
  it('usa name e pageSize da URL e calcula totalPages', async () => {
    patients.list.mockResolvedValue({ items: [patient], total: 12 });
    expect(await call('?page=2&pageSize=5&name=Carlos')).toMatchObject({
      status: 200,
      body: { data: [patientResponse], meta: { total: 12, page: 2, pageSize: 5, totalPages: 3 } },
    });
    expect(patients.list).toHaveBeenCalledWith({ page: 2, pageSize: 5, name: 'Carlos' });
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
  ])('query inválida %s retorna 400', async (query) => {
    expect(await call(`?${query}`)).toMatchObject({
      status: 400,
      body: { error: 'DADOS_INVALIDOS' },
    });
    expect(patients.list).not.toHaveBeenCalled();
  });
  it.each([UserRole.ADMIN, UserRole.SECRETARY])('%s altera name e preserva CPF', async (role) => {
    patients.update.mockResolvedValue({ ...patient, name: 'Nome atualizado' });
    expect(
      await call(`/${patient.id}`, { method: 'PATCH', body: { name: 'Nome atualizado' }, role }),
    ).toEqual({ status: 200, body: { ...patientResponse, name: 'Nome atualizado' } });
  });
  it('doctor não altera', async () => {
    expect(
      await call(`/${patient.id}`, {
        method: 'PATCH',
        body: { name: 'Outro nome' },
        role: UserRole.DOCTOR,
      }),
    ).toMatchObject({ status: 403, body: { error: 'ACESSO_NEGADO' } });
    expect(patients.update).not.toHaveBeenCalled();
  });
  it.each([{}, { name: '' }, { cpf: '52998224725' }, { name: 'Outro', cpf: '52998224725' }])(
    'PATCH fora do contrato retorna 400: %j',
    async (body) => {
      expect(await call(`/${patient.id}`, { method: 'PATCH', body })).toMatchObject({
        status: 400,
        body: { error: 'DADOS_INVALIDOS' },
      });
      expect(patients.update).not.toHaveBeenCalled();
    },
  );
  it.each([UserRole.SECRETARY, UserRole.DOCTOR])('%s não exclui', async (role) => {
    expect(await call(`/${patient.id}`, { method: 'DELETE', role })).toMatchObject({
      status: 403,
      body: { error: 'ACESSO_NEGADO' },
    });
    expect(patients.delete).not.toHaveBeenCalled();
  });
  it('admin exclui com 204 e sem corpo; nova consulta devolve 404', async () => {
    expect(await call(`/${patient.id}`, { method: 'DELETE' })).toEqual({ status: 204, body: '' });
    patients.findById.mockResolvedValue(null);
    expect(await call(`/${patient.id}`)).toMatchObject({
      status: 404,
      body: { error: 'RECURSO_NAO_ENCONTRADO' },
    });
  });
  it.each(['GET', 'PATCH', 'DELETE'])('%s em paciente inexistente retorna 404', async (method) => {
    patients.findById.mockResolvedValue(null);
    expect(
      await call(`/${patient.id}`, {
        method,
        body: method === 'PATCH' ? { name: 'Outro nome' } : undefined,
      }),
    ).toMatchObject({ status: 404, body: { error: 'RECURSO_NAO_ENCONTRADO' } });
  });
  it('UUID inválido devolve 400', async () => {
    expect(await call('/invalido')).toMatchObject({
      status: 400,
      body: { error: 'DADOS_INVALIDOS' },
    });
  });
});
