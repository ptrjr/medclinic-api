// Explicit opt-in: npm run build, then npm run test:functional.
// Reuses the integration target guards; never reads .env or stores bearer tokens.
import assert from 'node:assert/strict';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import jwt from 'jsonwebtoken';
import { createDataSource } from '../../src/database/create-data-source';
import { UserEntity } from '../../src/entities/user.entity';
import { PatientEntity } from '../../src/entities/patient.entity';
import { AppointmentEntity } from '../../src/entities/appointment.entity';
import { MedicalRecordEntity } from '../../src/entities/medical-record.entity';
import { assertIntegrationDatabase, integrationEnvironment } from '../integration/config';

type Body = Record<string, unknown>;
type Role = 'admin' | 'secretary' | 'doctor' | 'other' | 'anonymous';
interface Result {
  id: string;
  section: string;
  scenario: string;
  expected: string;
  observed: string;
  evidence: string;
  passed: boolean;
  ms?: number;
}

const results: Result[] = [];
const tokens: Partial<Record<Role, string>> = {};
const config = integrationEnvironment(process.env);
const source = createDataSource(config);
const runId = randomUUID();
const password = 'Functional-only@123'; // Synthetic, exclusive to the disposable database.
const adminEmail = 'admin@functional.test';
const contractRef = '7fa5d59e0de3a637a3161a4373b5fcbb92a88b9d';
const executionDate = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(new Date());
const base = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
let baseUrl = '';
let version = '';
let sequence = 0;
let cleanup = 'Não concluída';
let server: ChildProcess | undefined;

async function stopServer(): Promise<void> {
  const child = server;
  if (!child) return;
  if (child.pid && child.exitCode === null && child.signalCode === null) {
    const stopped = once(child, 'close', { signal: AbortSignal.timeout(10000) });
    void stopped.catch(() => undefined);
    try {
      assert.ok(child.kill('SIGTERM'), 'Não foi possível encerrar o servidor');
      await stopped;
    } catch {
      if (child.exitCode === null && child.signalCode === null) {
        const killed = once(child, 'close', { signal: AbortSignal.timeout(5000) });
        void killed.catch(() => undefined);
        assert.ok(child.kill('SIGKILL'), 'Não foi possível interromper o servidor');
        await killed;
      }
    }
  }
  server = undefined;
}

function inspectResponse(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  const object = value as Body;
  const required =
    'startsAt' in object
      ? ['id', 'patientId', 'startsAt', 'endsAt', 'status']
      : 'text' in object && 'patientId' in object
        ? ['id', 'doctorId', 'patientId', 'text', 'createdAt']
        : 'cpf' in object
          ? ['id', 'name', 'cpf', 'createdAt']
          : 'roles' in object && 'email' in object
            ? ['id', 'name', 'email']
            : [];
  for (const key of required)
    assert.equal(typeof object[key], 'string', `Campo obrigatório: ${key}`);
  for (const [key, item] of Object.entries(value)) {
    assert.ok(!['password', 'passwordHash', 'stack'].includes(key), `Campo indevido: ${key}`);
    if (['startsAt', 'endsAt', 'createdAt'].includes(key)) {
      assert.equal(typeof item, 'string');
      assert.match(item as string, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    }
    inspectResponse(item);
  }
}

function list(body: Body): Body[] {
  assert.ok(Array.isArray(body.data));
  const meta = body.meta as Record<string, number>;
  for (const key of ['total', 'page', 'pageSize', 'totalPages']) {
    assert.ok(Number.isInteger(meta[key]), `meta.${key}`);
  }
  assert.equal(meta.totalPages, Math.ceil(meta.total / meta.pageSize));
  assert.ok(body.data.length <= meta.pageSize);
  return body.data as Body[];
}

function id(body: Body): string {
  assert.equal(typeof body.id, 'string');
  assert.match(body.id as string, /^[0-9a-f-]{36}$/);
  return body.id as string;
}

async function check(
  section: string,
  scenario: string,
  expected: string,
  action: () => Promise<void>,
) {
  const row: Result = {
    id: `F${String(results.length + 1).padStart(3, '0')}`,
    section,
    scenario,
    expected,
    observed: 'Asserções verificadas',
    evidence: 'Bootstrap/SQL real',
    passed: false,
  };
  results.push(row);
  try {
    await action();
    row.passed = true;
  } catch (error) {
    row.observed = error instanceof Error ? error.message : 'Falha desconhecida';
    throw error;
  }
}

async function probe(
  section: string,
  scenario: string,
  method: string,
  path: string,
  status: number,
  options: {
    role?: Role;
    body?: unknown;
    code?: string;
    token?: string;
    raw?: string;
    verify?: (body: Body) => void;
  } = {},
): Promise<Body> {
  let body: Body = {};
  await check(
    section,
    scenario,
    `HTTP ${status}${options.code ? ` / ${options.code}` : ''}`,
    async () => {
      const role = options.role ?? 'admin';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (role !== 'anonymous') headers.Authorization = `Bearer ${options.token ?? tokens[role]}`;
      const started = performance.now();
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body:
          options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
        signal: AbortSignal.timeout(15000),
      });
      const text = await response.text();
      const row = results[results.length - 1];
      row.ms = Math.round((performance.now() - started) * 100) / 100;
      row.evidence = `${method} ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id')}`;
      row.observed = `HTTP ${response.status}`;
      assert.equal(response.status, status, scenario);
      if (status === 204) {
        assert.equal(text, '');
        return;
      }
      assert.match(response.headers.get('content-type') ?? '', /application\/json/);
      body = JSON.parse(text) as Body;
      inspectResponse(body);
      if (options.code) {
        assert.equal(body.statusCode, status);
        assert.equal(body.error, options.code);
        assert.equal(typeof body.message, 'string');
        assert.deepEqual(Object.keys(body).sort(), ['error', 'message', 'statusCode']);
        row.observed += ` / ${body.error}`;
      }
      options.verify?.(body);
    },
  );
  return body;
}

async function login(email: string, role: Role) {
  const body = await probe('4.9.2', `Login válido: ${role}`, 'POST', '/auth/login', 200, {
    role: 'anonymous',
    body: { email, password },
    verify: (value) => {
      assert.equal(typeof value.accessToken, 'string');
      const claims = jwt.decode(value.accessToken as string) as jwt.JwtPayload;
      assert.ok(claims.sub && Array.isArray(claims.roles));
      assert.ok(typeof claims.exp === 'number' && claims.exp > Date.now() / 1000);
    },
  });
  tokens[role] = body.accessToken as string;
}

async function patient(name: string, role: Role = 'admin') {
  return id(
    await probe('SETUP', `Preparar paciente ${name}`, 'POST', '/patients', 201, {
      role,
      body: { name, cpf: String(++sequence).padStart(11, '0') },
    }),
  );
}

async function doctor(name: string) {
  const email = `${name}@functional.test`;
  const body = await probe(
    '4.9.4',
    `Cadastrar médico ${name} com usuário doctor`,
    'POST',
    '/doctors',
    201,
    {
      body: { name: `Doctor ${name}`, email, password, crm: `CRM-${name}` },
      verify: (value) => {
        assert.equal(value.crm, `CRM-${name}`);
        const user = value.user as Body;
        assert.equal(user.email, email);
        assert.deepEqual(user.roles, ['doctor']);
        id(user);
      },
    },
  );
  return { id: id(body), userId: id(body.user as Body), email };
}

const shift = { weekDay: 2, startTime: '08:00', endTime: '12:00', slotDurationMinutes: 30 };
async function schedule(doctorId: string, shifts: unknown[], section = 'SETUP') {
  return probe(
    section,
    'Substituir escala integralmente',
    'PUT',
    `/doctors/${doctorId}/work-schedule`,
    200,
    {
      body: { shifts },
      verify: (value) => assert.deepEqual(value, { shifts }),
    },
  );
}

async function exercise() {
  const missing = randomUUID();
  await probe('4.9.2', 'Health público e corpo literal', 'GET', '/health', 200, {
    role: 'anonymous',
    verify: (body) => assert.deepEqual(body, { status: 'ok' }),
  });
  await login(adminEmail, 'admin');
  const me = await probe('4.9.2', 'users/me com campos e perfil admin', 'GET', '/users/me', 200, {
    verify: (body) => {
      id(body);
      assert.equal(body.email, adminEmail);
      assert.deepEqual(body.roles, ['admin']);
    },
  });
  for (const [name, body, status, code] of [
    [
      'senha incorreta',
      { email: adminEmail, password: 'Wrong-only@123' },
      401,
      'CREDENCIAIS_INVALIDAS',
    ],
    [
      'e-mail inexistente',
      { email: 'missing@functional.test', password },
      401,
      'CREDENCIAIS_INVALIDAS',
    ],
    ['sem e-mail', { password }, 400, 'DADOS_INVALIDOS'],
    ['sem senha', { email: adminEmail }, 400, 'DADOS_INVALIDOS'],
    ['e-mail inválido', { email: 'invalid', password }, 400, 'DADOS_INVALIDOS'],
  ] as const)
    await probe('4.9.2', `Login ${name}`, 'POST', '/auth/login', status, {
      body,
      code,
      role: 'anonymous',
    });
  for (const [name, token] of [
    ['inválido', 'invalid'],
    [
      'expirado',
      jwt.sign({ roles: ['admin'] }, config.JWT_SECRET, {
        subject: id(me),
        issuer: 'medclinic-api',
        audience: 'medclinic-api',
        algorithm: 'HS256',
        expiresIn: -1,
      }),
    ],
  ]) {
    await probe('4.9.2', `Token ${name}`, 'GET', '/users/me', 401, {
      token,
      code: 'NAO_AUTENTICADO',
    });
  }
  const protectedRoutes = [
    ['GET', '/users/me'],
    ['POST', '/users'],
    ['POST', '/patients'],
    ['GET', '/patients'],
    ['GET', `/patients/${missing}`],
    ['PATCH', `/patients/${missing}`],
    ['DELETE', `/patients/${missing}`],
    ['POST', '/doctors'],
    ['GET', '/doctors'],
    ['GET', `/doctors/${missing}`],
    ['PUT', `/doctors/${missing}/work-schedule`],
    ['GET', `/doctors/${missing}/work-schedule`],
    ['GET', `/doctors/${missing}/calendar?from=2030-04-02&to=2030-04-02`],
    ['POST', '/appointments'],
    ['GET', '/appointments'],
    ['GET', `/appointments/${missing}`],
    ['PATCH', `/appointments/${missing}/status`],
    ['POST', `/patients/${missing}/medical-records`],
    ['GET', `/patients/${missing}/medical-records`],
  ];
  for (const [method, path] of protectedRoutes)
    await probe('4.9.1', 'Rota protegida sem token', method, path, 401, {
      role: 'anonymous',
      code: 'NAO_AUTENTICADO',
    });
  for (const path of ['/auth/register', '/auth/signup', '/register'])
    await probe('4.9.2', 'Cadastro público ausente', 'POST', path, 404, {
      role: 'anonymous',
      body: { roles: ['admin'] },
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  const userInput = {
    name: 'Secretary Functional',
    email: 'secretary@functional.test',
    password,
    roles: ['secretary'],
  };
  await probe('4.9.2', 'Admin cria secretary sem dados sensíveis', 'POST', '/users', 201, {
    body: userInput,
    verify: (body) => {
      id(body);
      assert.equal(body.email, userInput.email);
      assert.deepEqual(body.roles, ['secretary']);
    },
  });
  await login(userInput.email, 'secretary');
  await probe('4.9.2', 'Secretário não cria admin', 'POST', '/users', 403, {
    role: 'secretary',
    body: { ...userInput, roles: ['admin'] },
    code: 'ACESSO_NEGADO',
  });
  await probe('4.9.2', 'Usuário com e-mail duplicado', 'POST', '/users', 409, {
    body: userInput,
    code: 'EMAIL_JA_CADASTRADO',
  });
  for (const body of [
    { ...userInput, roles: ['invalid'] },
    { ...userInput, roles: [] },
    { ...userInput, password: 'short' },
    { ...userInput, email: 'invalid' },
    { ...userInput, name: '' },
    { ...userInput, role: 'admin' },
  ])
    await probe('4.9.2', 'Usuário com dados/perfis inválidos', 'POST', '/users', 400, {
      body,
      code: 'DADOS_INVALIDOS',
    });
  await probe('4.9.2', 'Admin cria outro admin', 'POST', '/users', 201, {
    body: { ...userInput, email: 'second-admin@functional.test', roles: ['admin'] },
    verify: (body) => assert.deepEqual(body.roles, ['admin']),
  });
  const doc = await doctor('alpha');
  const other = await doctor('beta');
  await login(doc.email, 'doctor');
  await login(other.email, 'other');
  await probe('4.9.2', 'Doctor não cria usuários', 'POST', '/users', 403, {
    role: 'doctor',
    body: userInput,
    code: 'ACESSO_NEGADO',
  });

  const patientInput = { name: 'Paciente Principal', cpf: '12345678901' };
  const p = id(
    await probe(
      '4.9.3',
      'Cadastrar paciente mínimo literal por secretary',
      'POST',
      '/patients',
      201,
      {
        role: 'secretary',
        body: patientInput,
        verify: (body) => {
          id(body);
          assert.equal(body.name, patientInput.name);
          assert.equal(body.cpf, patientInput.cpf);
          assert.equal(typeof body.createdAt, 'string');
        },
      },
    ),
  );
  const p2 = await patient('Paciente Dois');
  const removed = await patient('Paciente Removido');
  const noCare = await patient('Paciente Sem Vínculo');
  await probe('4.9.3', 'Doctor não cadastra paciente', 'POST', '/patients', 403, {
    role: 'doctor',
    body: patientInput,
    code: 'ACESSO_NEGADO',
  });
  await probe('4.9.3', 'CPF duplicado', 'POST', '/patients', 409, {
    body: patientInput,
    code: 'CPF_JA_CADASTRADO',
  });
  for (const body of [
    { name: '', cpf: '11111111111' },
    { cpf: '11111111111' },
    { name: 'P', cpf: '123' },
    { name: 'P', cpf: '1234567890x' },
    { name: 'P', cpf: '123.456.789-01' },
  ])
    await probe('4.9.3', 'Paciente com entrada inválida', 'POST', '/patients', 400, {
      body,
      code: 'DADOS_INVALIDOS',
    });
  for (const role of ['admin', 'secretary', 'doctor'] as const)
    await probe('4.9.3', `Detalhe paciente por ${role}`, 'GET', `/patients/${p}`, 200, {
      role,
      verify: (body) => assert.equal(body.id, p),
    });
  await probe(
    '4.9.3',
    'Filtro de nome parcial sem diferenciar caixa',
    'GET',
    '/patients?name=pRiNcIp&page=1&pageSize=1',
    200,
    {
      verify: (body) => {
        assert.equal(list(body)[0].id, p);
        assert.deepEqual(body.meta, { page: 1, pageSize: 1, total: 1, totalPages: 1 });
      },
    },
  );
  await probe(
    '4.9.3',
    'Paginação de pacientes em segunda página',
    'GET',
    '/patients?page=2&pageSize=1',
    200,
    {
      role: 'doctor',
      verify: (body) => {
        assert.equal(list(body).length, 1);
        assert.equal((body.meta as Body).page, 2);
      },
    },
  );
  await probe(
    '4.9.3',
    'Busca vazia com meta e defaults',
    'GET',
    '/patients?name=NoMatchFunctional',
    200,
    {
      verify: (body) => {
        assert.equal(list(body).length, 0);
        assert.deepEqual(body.meta, { page: 1, pageSize: 20, total: 0, totalPages: 0 });
      },
    },
  );
  await probe('4.9.3', 'Secretário altera somente nome', 'PATCH', `/patients/${p}`, 200, {
    role: 'secretary',
    body: { name: 'Paciente Principal Atualizado' },
    verify: (body) => {
      assert.equal(body.name, 'Paciente Principal Atualizado');
      assert.equal(body.cpf, patientInput.cpf);
    },
  });
  await probe('4.9.3', 'Admin altera nome', 'PATCH', `/patients/${p2}`, 200, {
    body: { name: 'Paciente Dois Atualizado' },
  });
  for (const method of ['PATCH', 'DELETE'])
    await probe('4.9.3', `Doctor não executa ${method}`, method, `/patients/${p}`, 403, {
      role: 'doctor',
      body: method === 'PATCH' ? { name: 'Forbidden' } : undefined,
      code: 'ACESSO_NEGADO',
    });
  await probe('4.9.3', 'Secretário não exclui paciente', 'DELETE', `/patients/${p}`, 403, {
    role: 'secretary',
    code: 'ACESSO_NEGADO',
  });
  for (const body of [{ name: '' }, { cpf: '22222222222' }])
    await probe('4.9.3', 'PATCH paciente inválido', 'PATCH', `/patients/${p}`, 400, {
      body,
      code: 'DADOS_INVALIDOS',
    });
  for (const method of ['GET', 'PATCH', 'DELETE'])
    await probe('4.9.3', `Paciente inexistente: ${method}`, method, `/patients/${missing}`, 404, {
      body: method === 'PATCH' ? { name: 'Missing' } : undefined,
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  await probe('4.9.3', 'Exclusão lógica com 204 sem corpo', 'DELETE', `/patients/${removed}`, 204);
  for (const method of ['GET', 'PATCH', 'DELETE'])
    await probe('4.9.3', `Paciente removido: ${method}`, method, `/patients/${removed}`, 404, {
      body: method === 'PATCH' ? { name: 'Removed' } : undefined,
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  await probe('4.9.3', 'Removido ausente da listagem', 'GET', '/patients?name=Removido', 200, {
    verify: (body) => assert.equal(list(body).length, 0),
  });
  await check(
    'SQL',
    'Exclusão preserva registro e CPF',
    'deletedAt preenchido, registro preservado',
    async () => {
      const row = await source
        .getRepository(PatientEntity)
        .findOne({ where: { id: removed }, withDeleted: true });
      assert.ok(row?.deletedAt);
    },
  );

  const duplicateDoctor = {
    name: 'Duplicate',
    email: 'orphan@functional.test',
    password,
    crm: 'CRM-alpha',
  };
  await probe('4.9.4', 'CRM duplicado sem usuário órfão', 'POST', '/doctors', 409, {
    body: duplicateDoctor,
    code: 'CRM_JA_CADASTRADO',
  });
  await probe('4.9.4', 'Login do possível órfão recusado', 'POST', '/auth/login', 401, {
    role: 'anonymous',
    body: { email: duplicateDoctor.email, password },
    code: 'CREDENCIAIS_INVALIDAS',
  });
  await probe('4.9.4', 'E-mail duplicado de médico', 'POST', '/doctors', 409, {
    body: { ...duplicateDoctor, crm: 'CRM-new', email: doc.email },
    code: 'EMAIL_JA_CADASTRADO',
  });
  for (const role of ['secretary', 'doctor'] as const)
    await probe('4.9.4', `${role} não cadastra médico`, 'POST', '/doctors', 403, {
      role,
      body: duplicateDoctor,
      code: 'ACESSO_NEGADO',
    });
  for (const body of [
    { ...duplicateDoctor, name: '' },
    { ...duplicateDoctor, email: 'invalid' },
    { ...duplicateDoctor, crm: '' },
    { ...duplicateDoctor, password: 'short' },
  ])
    await probe('4.9.4', 'Médico com campo obrigatório inválido', 'POST', '/doctors', 400, {
      body,
      code: 'DADOS_INVALIDOS',
    });
  for (const role of ['admin', 'secretary', 'doctor'] as const)
    await probe('4.9.4', `Detalhe médico por ${role}`, 'GET', `/doctors/${doc.id}`, 200, {
      role,
      verify: (body) => {
        assert.equal(body.id, doc.id);
        assert.deepEqual((body.user as Body).roles, ['doctor']);
      },
    });
  await probe('4.9.4', 'Médico inexistente', 'GET', `/doctors/${missing}`, 404, {
    code: 'RECURSO_NAO_ENCONTRADO',
  });
  await probe(
    '4.9.4',
    'Filtro e paginação de médicos',
    'GET',
    '/doctors?name=ALP&pageSize=1',
    200,
    {
      verify: (body) => {
        assert.equal(list(body)[0].id, doc.id);
        assert.equal((body.meta as Body).total, 1);
      },
    },
  );
  await probe('4.9.4', 'Médicos: segunda página', 'GET', '/doctors?page=2&pageSize=1', 200, {
    verify: (body) => assert.equal(list(body).length, 1),
  });
  await probe('4.9.4', 'Médicos: busca vazia', 'GET', '/doctors?name=NoMatchFunctional', 200, {
    verify: (body) => assert.equal(list(body).length, 0),
  });

  await probe(
    '4.9.5',
    'Médico sem escala devolve shifts vazio',
    'GET',
    `/doctors/${doc.id}/work-schedule`,
    200,
    { verify: (body) => assert.deepEqual(body, { shifts: [] }) },
  );
  await schedule(doc.id, [shift], '4.9.5');
  for (const role of ['doctor', 'secretary'] as const)
    await probe(
      '4.9.5',
      `Escala não alterável por ${role}`,
      'PUT',
      `/doctors/${doc.id}/work-schedule`,
      403,
      { role, body: { shifts: [] }, code: 'ACESSO_NEGADO' },
    );
  for (const role of ['admin', 'doctor', 'secretary'] as const)
    await probe(
      '4.9.5',
      `Escala legível por ${role}`,
      'GET',
      `/doctors/${doc.id}/work-schedule`,
      200,
      { role, verify: (body) => assert.deepEqual(body, { shifts: [shift] }) },
    );
  for (const shifts of [
    [{ ...shift, weekDay: 7 }],
    [{ ...shift, startTime: '8:00' }],
    [{ ...shift, startTime: '25:00' }],
    [{ ...shift, startTime: '12:00' }],
    [{ ...shift, endTime: '07:00' }],
    [{ ...shift, slotDurationMinutes: 0 }],
    [{ ...shift, slotDurationMinutes: -5 }],
    [shift, { ...shift, startTime: '09:00' }],
  ])
    await probe(
      '4.9.5',
      'Turno inválido ou sobreposto',
      'PUT',
      `/doctors/${doc.id}/work-schedule`,
      400,
      { body: { shifts }, code: 'DADOS_INVALIDOS' },
    );
  await probe(
    '4.9.5',
    'Escala preservada após falhas',
    'GET',
    `/doctors/${doc.id}/work-schedule`,
    200,
    { verify: (body) => assert.deepEqual(body, { shifts: [shift] }) },
  );
  await schedule(doc.id, [shift, { ...shift, startTime: '12:00', endTime: '13:00' }], '4.9.5');
  await schedule(doc.id, [shift], '4.9.5');
  for (const method of ['GET', 'PUT'])
    await probe(
      '4.9.5',
      `Escala de médico inexistente: ${method}`,
      method,
      `/doctors/${missing}/work-schedule`,
      404,
      { body: method === 'PUT' ? { shifts: [] } : undefined, code: 'RECURSO_NAO_ENCONTRADO' },
    );

  const booking = { doctorId: doc.id, patientId: p, startsAt: '2030-04-02T08:00:00-03:00' };
  const ap = id(
    await probe(
      '4.9.7',
      'Agendamento válido: 08:00-03:00 vira 11:00Z; endsAt calculado',
      'POST',
      '/appointments',
      201,
      {
        role: 'secretary',
        body: booking,
        verify: (body) => {
          assert.equal(body.startsAt, '2030-04-02T11:00:00.000Z');
          assert.equal(body.endsAt, '2030-04-02T11:30:00.000Z');
          assert.equal(body.status, 'scheduled');
          assert.equal(body.doctorId, doc.id);
          assert.equal(body.patientId, p);
        },
      },
    ),
  );
  await schedule(other.id, [shift]);
  await probe('4.9.7', 'Doctor não agenda consulta', 'POST', '/appointments', 403, {
    role: 'doctor',
    body: booking,
    code: 'ACESSO_NEGADO',
  });
  for (const [name, body] of [
    ['médico inexistente', { ...booking, doctorId: missing }],
    ['paciente inexistente', { ...booking, patientId: missing }],
    ['paciente removido', { ...booking, patientId: removed }],
  ] as const)
    await probe('4.9.7', name, 'POST', '/appointments', 404, {
      body,
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  for (const startsAt of [
    '2030-04-02T07:30:00-03:00',
    '2030-04-03T08:00:00-03:00',
    '2030-04-02T08:15:00-03:00',
    '2030-04-02T08:00:01-03:00',
    '2030-04-02T12:00:00-03:00',
  ])
    await probe('4.9.7', `Fora da escala/grade: ${startsAt}`, 'POST', '/appointments', 422, {
      body: { ...booking, startsAt },
      code: 'HORARIO_FORA_DA_ESCALA',
    });
  await schedule(doc.id, [{ ...shift, endTime: '08:50' }]);
  await probe('4.9.7', 'Consulta não cabe inteira no turno', 'POST', '/appointments', 422, {
    body: { ...booking, startsAt: '2030-04-02T08:30:00-03:00' },
    code: 'HORARIO_FORA_DA_ESCALA',
  });
  await schedule(doc.id, [shift]);
  await probe(
    '4.9.7',
    'Conflito médico tem prioridade sobre paciente; mesmo instante em Z',
    'POST',
    '/appointments',
    409,
    { body: { ...booking, startsAt: '2030-04-02T11:00:00Z' }, code: 'HORARIO_INDISPONIVEL' },
  );
  await probe('4.9.7', 'Conflito médico com outro paciente', 'POST', '/appointments', 409, {
    body: { ...booking, patientId: p2 },
    code: 'HORARIO_INDISPONIVEL',
  });
  await probe('4.9.7', 'Conflito paciente com outro médico', 'POST', '/appointments', 409, {
    body: { ...booking, doctorId: other.id },
    code: 'PACIENTE_INDISPONIVEL',
  });
  const touching = id(
    await probe('4.9.7', 'Intervalo encostado permitido', 'POST', '/appointments', 201, {
      body: { ...booking, startsAt: '2030-04-02T08:30:00-03:00' },
      verify: (body) => assert.equal(body.endsAt, '2030-04-02T12:00:00.000Z'),
    }),
  );
  await check(
    'SQL',
    'Conflitos não gravam; fins persistidos e intervalos encostados',
    'Exatamente duas consultas, com limites calculados',
    async () => {
      const rows = await source
        .getRepository(AppointmentEntity)
        .find({ order: { startsAt: 'ASC' } });
      assert.equal(rows.length, 2);
      assert.equal(rows[0].endsAt.toISOString(), '2030-04-02T11:30:00.000Z');
      assert.equal(rows[0].endsAt.getTime(), rows[1].startsAt.getTime());
    },
  );
  for (const role of ['admin', 'secretary', 'doctor'] as const)
    await probe('4.9.7', `Detalhe consulta por ${role}`, 'GET', `/appointments/${ap}`, 200, {
      role,
      verify: (body) => assert.equal(body.id, ap),
    });
  await probe('4.9.7', 'Outro médico não acessa detalhe', 'GET', `/appointments/${ap}`, 403, {
    role: 'other',
    code: 'ACESSO_NEGADO',
  });
  await probe('4.9.7', 'Consulta inexistente', 'GET', `/appointments/${missing}`, 404, {
    code: 'RECURSO_NAO_ENCONTRADO',
  });
  await probe(
    '4.9.7',
    'Filtros combinados, período local e paginação',
    'GET',
    `/appointments?doctorId=${doc.id}&patientId=${p}&status=scheduled&from=2030-04-02&to=2030-04-02&pageSize=1&page=2`,
    200,
    {
      verify: (body) => {
        assert.equal(list(body).length, 1);
        assert.deepEqual(body.meta, { page: 2, pageSize: 1, total: 2, totalPages: 2 });
      },
    },
  );
  await probe('4.9.7', 'Doctor só lista consultas próprias', 'GET', '/appointments', 200, {
    role: 'other',
    verify: (body) => assert.equal(list(body).length, 0),
  });
  await probe(
    '4.9.7',
    'Doctor não força filtro para médico alheio',
    'GET',
    `/appointments?doctorId=${doc.id}`,
    200,
    { role: 'other', verify: (body) => assert.equal(list(body).length, 0) },
  );
  await probe('4.9.7', 'Doctor dono lista suas consultas', 'GET', '/appointments', 200, {
    role: 'doctor',
    verify: (body) => {
      assert.equal(list(body).length, 2);
      assert.ok(list(body).every((item) => item.doctorId === doc.id));
    },
  });
  await probe(
    '4.9.6',
    'Agenda com escala e consultas, sem slots artificiais',
    'GET',
    `/doctors/${doc.id}/calendar?from=2030-04-02&to=2030-04-02`,
    200,
    {
      role: 'secretary',
      verify: (body) => {
        assert.deepEqual(body.workSchedule, { shifts: [shift] });
        assert.equal((body.appointments as Body[]).length, 2);
        assert.equal(body.slots, undefined);
      },
    },
  );
  for (const query of [
    'from=invalid&to=2030-04-02',
    'from=2030-02-30&to=2030-04-02',
    'from=2030-04-03&to=2030-04-02',
    'from=2030-04-01&to=2030-05-02',
    'from=2030-04-02',
    '',
  ])
    await probe(
      '4.9.6',
      `Agenda com período inválido: ${query || 'ausente'}`,
      'GET',
      `/doctors/${doc.id}/calendar?${query}`,
      400,
      { code: 'DADOS_INVALIDOS' },
    );
  await probe(
    '4.9.6',
    'Agenda aceita exatamente 31 dias',
    'GET',
    `/doctors/${doc.id}/calendar?from=2030-04-01&to=2030-05-01`,
    200,
    { verify: (body) => assert.ok(Array.isArray(body.appointments)) },
  );
  await probe(
    '4.9.6',
    'Agenda de médico inexistente',
    'GET',
    `/doctors/${missing}/calendar?from=2030-04-02&to=2030-04-02`,
    404,
    { code: 'RECURSO_NAO_ENCONTRADO' },
  );
  await schedule(doc.id, [], '4.9.5');
  await probe(
    '4.9.7',
    'Limpar escala preserva consulta e endsAt',
    'GET',
    `/appointments/${ap}`,
    200,
    { verify: (body) => assert.equal(body.endsAt, '2030-04-02T11:30:00.000Z') },
  );
  await probe(
    '4.9.5',
    'Escala limpa lida como lista vazia',
    'GET',
    `/doctors/${doc.id}/work-schedule`,
    200,
    { verify: (body) => assert.deepEqual(body, { shifts: [] }) },
  );
  await schedule(doc.id, [shift]);

  await probe(
    '4.9.8',
    'Scheduled não concede leitura',
    'GET',
    `/patients/${p}/medical-records`,
    403,
    { role: 'doctor', code: 'ACESSO_NEGADO' },
  );
  await probe(
    '4.9.8',
    'Scheduled não concede escrita',
    'POST',
    `/patients/${p}/medical-records`,
    403,
    { role: 'doctor', body: { text: 'Synthetic note' }, code: 'ACESSO_NEGADO' },
  );
  await probe('4.9.7', 'Secretário cancela scheduled', 'PATCH', `/appointments/${ap}/status`, 200, {
    role: 'secretary',
    body: { status: 'cancelled' },
    verify: (body) => assert.equal(body.status, 'cancelled'),
  });
  await probe(
    '4.9.8',
    'Cancelled não concede vínculo',
    'GET',
    `/patients/${p}/medical-records`,
    403,
    { role: 'doctor', code: 'ACESSO_NEGADO' },
  );
  await probe(
    '4.9.6',
    'Canceladas excluídas da agenda',
    'GET',
    `/doctors/${doc.id}/calendar?from=2030-04-02&to=2030-04-02`,
    200,
    {
      verify: (body) => {
        const items = body.appointments as Body[];
        assert.equal(items.length, 1);
        assert.equal(items[0].id, touching);
      },
    },
  );
  const replacement = id(
    await probe('4.9.7', 'Cancelamento libera médico e paciente', 'POST', '/appointments', 201, {
      body: booking,
    }),
  );
  await probe(
    '4.9.7',
    'Consulta cancelada preservada no histórico filtrado',
    'GET',
    '/appointments?status=cancelled',
    200,
    { verify: (body) => assert.equal(list(body)[0].id, ap) },
  );
  await probe(
    '4.9.7',
    'Doctor dono inicia consulta',
    'PATCH',
    `/appointments/${replacement}/status`,
    200,
    {
      role: 'doctor',
      body: { status: 'in_progress' },
      verify: (body) => assert.equal(body.status, 'in_progress'),
    },
  );

  const records = `/patients/${p}/medical-records`;
  const record1 = id(
    await probe(
      '4.9.8',
      'Vínculo in_progress permite escrever; doctorId do corpo ignorado',
      'POST',
      records,
      201,
      {
        role: 'doctor',
        body: { text: '  First synthetic note  ', doctorId: other.id },
        verify: (body) => {
          assert.equal(body.doctorId, doc.id);
          assert.equal(body.patientId, p);
          assert.equal(body.text, 'First synthetic note');
        },
      },
    ),
  );
  await probe('4.9.8', 'doctorId inválido do corpo também ignorado', 'POST', records, 201, {
    role: 'doctor',
    body: { text: 'Second synthetic note', doctorId: 'invalid' },
    verify: (body) => assert.equal(body.doctorId, doc.id),
  });
  for (const role of ['admin', 'secretary', 'other'] as const)
    await probe('4.9.8', `${role} sem vínculo/perfil não escreve`, 'POST', records, 403, {
      role,
      body: { text: 'Forbidden' },
      code: 'ACESSO_NEGADO',
    });
  for (const role of ['secretary', 'other'] as const)
    await probe('4.9.8', `${role} não lê prontuário`, 'GET', records, 403, {
      role,
      code: 'ACESSO_NEGADO',
    });
  for (const body of [{}, { text: '' }, { text: '   ' }, { text: 123 }])
    await probe('4.9.8', 'Texto inválido', 'POST', records, 400, {
      role: 'doctor',
      body,
      code: 'DADOS_INVALIDOS',
    });
  for (const role of ['admin', 'doctor'] as const)
    await probe(
      '4.9.8',
      `Leitura e ordem decrescente por ${role}`,
      'GET',
      `${records}?pageSize=1`,
      200,
      {
        role,
        verify: (body) => {
          assert.equal(list(body).length, 1);
          assert.equal(list(body)[0].text, 'Second synthetic note');
          assert.deepEqual(body.meta, { page: 1, pageSize: 1, total: 2, totalPages: 2 });
        },
      },
    );
  await probe('4.9.8', 'Segunda página de prontuário', 'GET', `${records}?page=2&pageSize=1`, 200, {
    role: 'doctor',
    verify: (body) => assert.equal(list(body)[0].id, record1),
  });
  await probe(
    '4.9.8',
    'Prontuário vazio por admin',
    'GET',
    `/patients/${noCare}/medical-records`,
    200,
    {
      verify: (body) => {
        assert.equal(list(body).length, 0);
        assert.equal((body.meta as Body).totalPages, 0);
      },
    },
  );
  for (const method of ['GET', 'POST']) {
    for (const target of [noCare])
      await probe(
        '4.9.8',
        `Sem vínculo: ${method}`,
        method,
        `/patients/${target}/medical-records`,
        403,
        {
          role: 'doctor',
          body: method === 'POST' ? { text: 'No care' } : undefined,
          code: 'ACESSO_NEGADO',
        },
      );
    for (const target of [missing, removed])
      await probe(
        '4.9.8',
        `Paciente inexistente/removido: ${method}`,
        method,
        `/patients/${target}/medical-records`,
        404,
        {
          role: 'doctor',
          body: method === 'POST' ? { text: 'Missing' } : undefined,
          code: 'RECURSO_NAO_ENCONTRADO',
        },
      );
  }
  await probe(
    '4.9.7',
    'Doctor dono conclui consulta',
    'PATCH',
    `/appointments/${replacement}/status`,
    200,
    { role: 'doctor', body: { status: 'done' } },
  );
  await probe('4.9.8', 'Vínculo done continua permitindo escrita', 'POST', records, 201, {
    role: 'doctor',
    body: { text: 'Done synthetic note' },
    verify: (body) => assert.equal(body.doctorId, doc.id),
  });
  await check(
    'SQL',
    'Autoria e vínculo persistidos',
    'Três registros do médico autenticado',
    async () => {
      const rows = await source.getRepository(MedicalRecordEntity).findBy({ patientId: p });
      assert.equal(rows.length, 3);
      assert.ok(rows.every((row) => row.doctorId === doc.id));
    },
  );

  // Every state/target pair, under all four relevant authorities, through HTTP.
  const transitionDoctor = await doctor('transitions');
  await schedule(
    transitionDoctor.id,
    Array.from({ length: 7 }, (_, weekDay) => ({ ...shift, weekDay })),
  );
  const ownToken = await probe(
    'SETUP',
    'Login do médico da matriz de transições',
    'POST',
    '/auth/login',
    200,
    { role: 'anonymous', body: { email: transitionDoctor.email, password } },
  );
  let slot = Date.parse('2030-05-01T11:00:00Z');
  const states = ['scheduled', 'in_progress', 'done', 'cancelled'] as const;
  for (const current of states)
    for (const next of states)
      for (const role of ['admin', 'secretary', 'doctor', 'other'] as const) {
        if (new Date(slot).getUTCHours() >= 15)
          slot = Date.parse(`${new Date(slot + 86400000).toISOString().slice(0, 10)}T11:00:00Z`);
        const transitionId = id(
          await probe('SETUP', 'Consulta isolada para transição', 'POST', '/appointments', 201, {
            body: {
              doctorId: transitionDoctor.id,
              patientId: p2,
              startsAt: new Date(slot).toISOString(),
            },
          }),
        );
        slot += 30 * 60000;
        if (current === 'in_progress' || current === 'done')
          await probe(
            'SETUP',
            'Preparar in_progress',
            'PATCH',
            `/appointments/${transitionId}/status`,
            200,
            { body: { status: 'in_progress' } },
          );
        if (current === 'done' || current === 'cancelled')
          await probe(
            'SETUP',
            `Preparar ${current}`,
            'PATCH',
            `/appointments/${transitionId}/status`,
            200,
            { body: { status: current } },
          );
        const valid =
          (current === 'scheduled' && ['in_progress', 'cancelled'].includes(next)) ||
          (current === 'in_progress' && ['done', 'cancelled'].includes(next));
        const allowed =
          role === 'admin' ||
          role === 'doctor' ||
          (role === 'secretary' && current === 'scheduled' && next === 'cancelled');
        const expected = !valid ? 422 : allowed ? 200 : 403;
        await probe(
          '4.9.7',
          `Transição ${current} → ${next}, ${role === 'doctor' ? 'doctor dono' : role}`,
          'PATCH',
          `/appointments/${transitionId}/status`,
          expected,
          {
            role,
            token: role === 'doctor' ? (ownToken.accessToken as string) : undefined,
            body: { status: next },
            code: !valid ? 'TRANSICAO_INVALIDA' : !allowed ? 'ACESSO_NEGADO' : undefined,
            verify: expected === 200 ? (body) => assert.equal(body.status, next) : undefined,
          },
        );
        await check(
          'SQL',
          `Estado após ${current} → ${next} por ${role}`,
          expected === 200 ? next : current,
          async () => {
            const row = await source
              .getRepository(AppointmentEntity)
              .findOneByOrFail({ id: transitionId });
            assert.equal(row.status, expected === 200 ? next : current);
          },
        );
      }
  await probe('4.9.7', 'Status fora do enum', 'PATCH', `/appointments/${ap}/status`, 400, {
    body: { status: 'invalid' },
    code: 'DADOS_INVALIDOS',
  });
  await probe(
    '4.9.7',
    'Transição de consulta inexistente',
    'PATCH',
    `/appointments/${missing}/status`,
    404,
    { body: { status: 'done' }, code: 'RECURSO_NAO_ENCONTRADO' },
  );

  // Local days straddle UTC midnight: exercise boundaries without host timezone.
  await schedule(
    other.id,
    Array.from({ length: 7 }, (_, weekDay) => ({
      weekDay,
      startTime: '23:30',
      endTime: '23:59',
      slotDurationMinutes: 10,
    })),
  );
  const midnight = id(
    await probe(
      '4.9.1',
      '23:30 local pertence ao dia anterior em relação ao UTC',
      'POST',
      '/appointments',
      201,
      {
        body: { doctorId: other.id, patientId: p2, startsAt: '2030-07-02T23:30:00-03:00' },
        verify: (body) => {
          assert.equal(body.startsAt, '2030-07-03T02:30:00.000Z');
          assert.equal(body.endsAt, '2030-07-03T02:40:00.000Z');
        },
      },
    ),
  );
  for (const [day, count] of [
    ['2030-07-02', 1],
    ['2030-07-03', 0],
  ] as const) {
    await probe(
      '4.9.6',
      `Agenda inclusiva no dia local ${day}`,
      'GET',
      `/doctors/${other.id}/calendar?from=${day}&to=${day}`,
      200,
      {
        verify: (body) => {
          const items = body.appointments as Body[];
          assert.equal(items.length, count);
          if (count) assert.equal(items[0].id, midnight);
        },
      },
    );
    await probe(
      '4.9.7',
      `Filtro de consultas no dia local ${day}`,
      'GET',
      `/appointments?doctorId=${other.id}&from=${day}&to=${day}`,
      200,
      { verify: (body) => assert.equal(list(body).length, count) },
    );
  }
  const midnightShifts = Array.from({ length: 7 }, (_, weekDay) => ({
    weekDay,
    startTime: '00:00',
    endTime: '00:30',
    slotDurationMinutes: 30,
  }));
  await schedule(other.id, midnightShifts);
  const zero = id(
    await probe('4.9.1', '00:00 local é limite inferior inclusivo', 'POST', '/appointments', 201, {
      body: { doctorId: other.id, patientId: p2, startsAt: '2030-07-03T03:00:00Z' },
      verify: (body) => assert.equal(body.startsAt, '2030-07-03T03:00:00.000Z'),
    }),
  );
  await probe(
    '4.9.6',
    'Dia anterior exclui exatamente 00:00 do seguinte',
    'GET',
    `/doctors/${other.id}/calendar?from=2030-07-02&to=2030-07-02`,
    200,
    {
      verify: (body) => assert.ok(!(body.appointments as Body[]).some((item) => item.id === zero)),
    },
  );

  for (const startsAt of ['2030-04-02T08:00:00', 'not-a-date'])
    await probe('4.9.1', 'Instante sem fuso ou inválido', 'POST', '/appointments', 400, {
      body: { ...booking, startsAt },
      code: 'DADOS_INVALIDOS',
    });
  await probe('4.9.1', 'Cliente não informa endsAt', 'POST', '/appointments', 400, {
    body: { ...booking, endsAt: '2030-04-02T12:00:00Z' },
    code: 'DADOS_INVALIDOS',
  });
  for (const path of [
    '/patients/invalid',
    '/doctors/invalid',
    '/appointments/invalid',
    '/doctors/invalid/work-schedule',
    '/patients/invalid/medical-records',
  ])
    await probe('4.9.1', 'UUID inválido', 'GET', path, 400, { code: 'DADOS_INVALIDOS' });
  for (const path of ['/patients', '/doctors', '/appointments', records])
    for (const query of ['page=0', 'pageSize=101', 'page=1.5', 'pageSize=abc'])
      await probe('4.9.1', `Paginação inválida: ${query}`, 'GET', `${path}?${query}`, 400, {
        code: 'DADOS_INVALIDOS',
      });
  for (const query of [
    'doctorId=invalid',
    'patientId=invalid',
    'status=invalid',
    'from=2030-02-30',
    'from=2030-04-03&to=2030-04-02',
  ])
    await probe('4.9.7', `Filtro inválido: ${query}`, 'GET', `/appointments?${query}`, 400, {
      code: 'DADOS_INVALIDOS',
    });
  await probe('4.9.1', 'JSON malformado não derruba servidor', 'POST', '/patients', 400, {
    raw: '{',
    code: 'DADOS_INVALIDOS',
  });
  await probe('4.9.1', 'JSON acima de 100 kb tratado sem stack', 'POST', '/patients', 400, {
    body: { name: 'x'.repeat(103000) },
    code: 'DADOS_INVALIDOS',
  });
  await probe('4.9.1', 'Rota desconhecida tem envelope central', 'GET', '/not-found', 404, {
    code: 'RECURSO_NAO_ENCONTRADO',
  });
  await probe(
    '4.9.1',
    'Health permanece disponível após entradas inválidas',
    'GET',
    '/health',
    200,
    { role: 'anonymous', verify: (body) => assert.deepEqual(body, { status: 'ok' }) },
  );
  await verifySharedRecords(p, doc.id, other.id);
}

async function verifySharedRecords(patientId: string, doctorId: string, otherId: string) {
  const path = `/patients/${patientId}/medical-records`;
  await schedule(otherId, [shift]);
  const appointmentId = id(
    await probe(
      'SETUP',
      'Atendimento de outro médico para o mesmo paciente',
      'POST',
      '/appointments',
      201,
      {
        body: { doctorId: otherId, patientId, startsAt: '2030-08-06T08:00:00-03:00' },
      },
    ),
  );
  await probe(
    'SETUP',
    'Outro médico inicia seu atendimento',
    'PATCH',
    `/appointments/${appointmentId}/status`,
    200,
    { role: 'other', body: { status: 'in_progress' } },
  );
  await probe('4.9.8', 'Outro médico com vínculo lê registros alheios', 'GET', path, 200, {
    role: 'other',
    verify: (body) => {
      assert.equal(list(body).length, 3);
      assert.ok(list(body).every((item) => item.doctorId === doctorId));
    },
  });
  await probe('4.9.8', 'Outro médico escreve com sua própria autoria', 'POST', path, 201, {
    role: 'other',
    body: { text: 'Other doctor synthetic note', doctorId },
    verify: (body) => assert.equal(body.doctorId, otherId),
  });
  await probe('4.9.8', 'Primeiro médico lê registros dos dois autores', 'GET', path, 200, {
    role: 'doctor',
    verify: (body) => {
      assert.equal(list(body).length, 4);
      assert.equal(list(body)[0].doctorId, otherId);
    },
  });
  await probe(
    '4.9.3',
    'Exclusão lógica de paciente com histórico clínico',
    'DELETE',
    `/patients/${patientId}`,
    204,
  );
  for (const role of ['admin', 'doctor', 'other'] as const)
    await probe('4.9.8', `Histórico de removido inacessível a ${role}`, 'GET', path, 404, {
      role,
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  await check(
    'SQL',
    'Exclusão lógica preserva prontuários e consultas',
    'Paciente removido, quatro prontuários e consultas preservados',
    async () => {
      const row = await source
        .getRepository(PatientEntity)
        .findOne({ where: { id: patientId }, withDeleted: true });
      assert.ok(row?.deletedAt);
      assert.equal(await source.getRepository(MedicalRecordEntity).countBy({ patientId }), 4);
      assert.ok((await source.getRepository(AppointmentEntity).countBy({ patientId })) > 0);
    },
  );
}

async function freePort(): Promise<number> {
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    listener.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

function writeReport(fatal?: unknown) {
  const http = results.filter((row) => row.ms !== undefined);
  const actual = results.filter((row) => row.section !== 'SETUP');
  const max = Math.max(0, ...http.map((row) => row.ms!));
  const over = http.filter((row) => row.ms! > 5000);
  const escape = (value: string) => value.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
  const groups = [...new Set(results.map((row) => row.section))].map((section) => {
    const rows = results.filter((row) => row.section === section);
    return `| ${section} | ${rows.length} | ${rows.filter((row) => row.passed).length} |`;
  });
  const report = `# Verificação funcional completa local — ${executionDate}

Branch: \`test/validacao-funcional-completa\`. Base: \`${base}\`.
PR #19 incorporado por merge commit, sem bypass, após conferir head e três checks.
Enunciado consultado: [README em ${contractRef}](https://github.com/marcomoura-senai/nestjs-clinica/blob/${contractRef}/README.md), blob \`44474bec8858fa40a100edc14519ec366e073d1b\`.

## Contrato e limites

A referência atual ainda diverge internamente: seção 4.9.5 e sua tabela de erros exigem admin para alterar escala, enquanto o resumo 4.9.9 inclui doctor. Preservada a decisão explícita das etapas anteriores: somente admin altera. A seção 4.7 menciona 10 commits/3 PRs e a rubrica exige 20/6; mantido o requisito de entrega 20/6. O catálogo não especifica literal para falhas inesperadas 500; permanece ERRO_INTERNO, coberto pela integração existente. Nenhum comportamento foi alterado para acomodar essas divergências.

Esta é uma matriz própria, local, rastreada às seções 4.9/RN. Não houve acesso ou execução da bateria privada do professor, nem validação pública ou deploy. A amostra de latência não é garantia universal. Dados e credenciais são fictícios; bearer tokens, senhas e hashes não são registrados na matriz.

## Ambiente e execução

- Node ${process.version}; processo de teste TZ=${process.env.TZ ?? '(não definido)'}; clínica America/Sao_Paulo.
- ${version}; host ${config.DB_HOST}, porta ${config.DB_PORT}, banco medclinic_integration_test, synchronize=false.
- O procedimento desta validação usa o Compose exclusivo medclinic-functional-stage3-20261029, arquivo compose.integration.yaml, dados em tmpfs e porta publicada somente em loopback; o executor não cria nem remove containers.
- Build prévio: npm run build. Executor: npm run test:functional, com as cinco variáveis INTEGRATION_DB_* explícitas conforme docs/testes-integracao-postgresql.md, usando porta 55434 nesta execução. O executor usa as mesmas validações de destino da integração e não é incluído em test/test:cov.
- Inicialização normal: node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js; node dist/database/seed-admin.js (duas vezes, com verificação de preservação); node dist/server.js. São os comandos dos scripts de produção. As variáveis de cada filho são explícitas e DOTENV_CONFIG_PATH aponta para caminho descartável inexistente; o .env do projeto não é lido nem sobrescrito.
- Antes da primeira limpeza: nome do banco, versão 16, loopback, advisory lock de sessão e schema public vazio. Se houver objetos pré-existentes, o executor recusa a execução sem removê-los. A limpeza final só é autorizada depois dessa verificação e o destino é reconferido. Limpeza: ${cleanup}.

## Resultados observados

${results.length} verificações executadas: ${results.filter((row) => row.passed).length} aprovadas e ${results.filter((row) => !row.passed).length} falhas. São ${actual.length} verificações fora de preparação; ${http.length} requisições HTTP com asserções e ${results.length - http.length} verificações de bootstrap/SQL. SETUP identifica preparação real por HTTP, separada dos cenários de contrato. Máximo observado aquecido: ${max.toFixed(2)} ms; respostas acima de 5000 ms: ${over.length}. Falha fatal: ${fatal ? escape(fatal instanceof Error ? fatal.message : String(fatal)) : 'nenhuma'}. ${fatal ? 'Execução interrompida: os cenários posteriores à falha não foram executados.' : 'Todos os cenários previstos neste executor foram executados.'}

| Seção | Executados | Aprovados |
| --- | --- | --- |
${groups.join('\n')}

## Matriz rastreável

Cada requisição HTTP exige asserções de status, envelope/código quando aplicável, ausência de senha/hash/stack e instantes UTC; os cenários de sucesso verificam os campos e regras descritos. As 64 combinações de transição usam estado preparado por HTTP e conferência adicional da persistência. Casos concorrentes e rollback forçado são responsabilidade da suíte de integração existente, executada separadamente.

| ID | Seção | Cenário | Esperado | Observado | Evidência | ms | Resultado |
| --- | --- | --- | --- | --- | --- | --- | --- |
${results.map((row) => `| ${row.id} | ${row.section} | ${escape(row.scenario)} | ${escape(row.expected)} | ${escape(row.observed)} | ${escape(row.evidence)} | ${row.ms ?? '—'} | ${row.passed ? 'Aprovado' : 'FALHOU'} |`).join('\n')}

## Falhas e pendências

${fatal ? 'Investigar a falha acima antes de concluir a validação.' : 'Nenhum defeito da aplicação comprovado nesta execução.'} A integração PostgreSQL, os checks locais e a remoção do Compose são registrados após a execução. Publicação, banco gerenciado com SSL, URL pública, credenciais de avaliação e conferência pública permanecem pendentes.
`;
  writeFileSync('docs/verificacao-funcional-completa.md', report);
  console.log(
    JSON.stringify({
      total: results.length,
      passed: results.filter((row) => row.passed).length,
      http: http.length,
      nonSetup: actual.length,
      maxMs: max,
      over5s: over.length,
      cleanup,
      report: 'docs/verificacao-funcional-completa.md',
    }),
  );
}

async function main() {
  source.setOptions({
    extra: {
      application_name: `medclinic-functional-${runId}`,
      connectionTimeoutMillis: 5000,
      statement_timeout: 12000,
    },
  });
  const owner = source.createQueryRunner();
  let owns = false;
  let locked = false;
  let fatal: unknown;
  const assertTarget = async () => {
    assertIntegrationDatabase(source.options.database);
    const [target] = await source.query(
      "SELECT current_database() AS database, current_setting('server_version_num')::int AS version",
    );
    assertIntegrationDatabase(target.database);
    assert.ok(target.version >= 160000 && target.version < 170000);
  };
  try {
    await source.initialize();
    await check(
      'BOOT',
      'Destino local descartável, PostgreSQL 16 e synchronize false',
      'Guards originais e versão real',
      async () => {
        await assertTarget();
        assert.equal(source.options.synchronize, false);
        const [row] = await source.query('SELECT version()');
        version = row.version;
      },
    );
    await owner.connect();
    const [lock] = await owner.query('SELECT pg_try_advisory_lock(179158, 16) AS acquired');
    assert.equal(lock.acquired, true, 'Outra suíte está usando o banco');
    locked = true;
    await assertTarget();
    const [existing] = await source.query(
      "SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public') AS objects",
    );
    assert.equal(
      Number(existing.objects),
      0,
      'Schema public não está vazio; nenhum dado será removido',
    );
    owns = true;
    await source.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    const port = await freePort();
    baseUrl = `http://127.0.0.1:${port}/api/v1`;
    const childEnv = {
      ...process.env,
      DB_HOST: config.DB_HOST,
      DB_PORT: String(config.DB_PORT),
      DB_USERNAME: config.DB_USERNAME,
      DB_PASSWORD: config.DB_PASSWORD,
      DB_DATABASE: config.DB_DATABASE,
      DB_SSL: 'false',
      JWT_SECRET: config.JWT_SECRET,
      JWT_EXPIRES_IN: '1h',
      PORT: String(port),
      ADMIN_NAME: 'Functional Admin',
      ADMIN_EMAIL: adminEmail,
      ADMIN_PASSWORD: password,
      PGAPPNAME: `medclinic-functional-child-${runId}`,
      DOTENV_CONFIG_PATH: join(tmpdir(), `medclinic-no-env-${runId}`),
    };
    const run = (args: string[], env = childEnv) =>
      execFileSync(process.execPath, args, {
        env,
        timeout: 30000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    await check(
      'BOOT',
      'Migrations reais pelo CLI compilado, repetição idempotente',
      'Oito migrations; segunda execução sem alterações',
      async () => {
        run(['node_modules/typeorm/cli.js', 'migration:run', '-d', 'dist/database/data-source.js']);
        const before = await source.query('SELECT * FROM migrations ORDER BY id');
        assert.equal(before.length, 8);
        run(['node_modules/typeorm/cli.js', 'migration:run', '-d', 'dist/database/data-source.js']);
        assert.deepEqual(await source.query('SELECT * FROM migrations ORDER BY id'), before);
      },
    );
    await check(
      'BOOT',
      'Seed normal cria admin com hash e preserva ao repetir',
      'Mesmo id/nome/hash, apenas um admin',
      async () => {
        run(['dist/database/seed-admin.js']);
        const users = source.getRepository(UserEntity);
        const before = await users.findOneByOrFail({ email: adminEmail });
        assert.match(before.passwordHash, /^\$2[ab]\$/);
        assert.notEqual(before.passwordHash, password);
        run(['dist/database/seed-admin.js'], {
          ...childEnv,
          ADMIN_NAME: 'Do not replace',
          ADMIN_PASSWORD: 'Changed-only@123',
        });
        const after = await users.findOneByOrFail({ email: adminEmail });
        assert.equal(after.id, before.id);
        assert.equal(after.name, before.name);
        assert.ok(after.passwordHash === before.passwordHash, 'Hash deve ser preservado');
        assert.equal(await users.count(), 1);
      },
    );
    server = spawn(process.execPath, ['dist/server.js'], {
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout?.resume();
    server.stderr?.resume();
    let startupError: Error | undefined;
    server.on('error', (error) => {
      startupError = error;
    });
    await check(
      'BOOT',
      'Servidor normal compilado inicia e aquece',
      'Health HTTP real disponível',
      async () => {
        const deadline = Date.now() + 10000;
        let ready = false;
        while (Date.now() < deadline && server?.exitCode === null && !startupError) {
          try {
            const response = await fetch(`${baseUrl}/health`, {
              signal: AbortSignal.timeout(1000),
            });
            if (response.ok) {
              ready = true;
              break;
            }
          } catch {
            /* Wait for the readiness condition, bounded by deadline. */
          }
          await delay(50);
        }
        assert.ok(ready, startupError?.message ?? 'Servidor não ficou pronto');
        for (let n = 0; n < 5; n++)
          assert.equal(
            (await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1000) })).status,
            200,
          );
      },
    );
    await exercise();
    await probe(
      'BOOT',
      'Senha alternativa do segundo seed não foi aplicada',
      'POST',
      '/auth/login',
      401,
      {
        role: 'anonymous',
        body: { email: adminEmail, password: 'Changed-only@123' },
        code: 'CREDENCIAIS_INVALIDAS',
      },
    );
  } catch (error) {
    fatal = error;
    process.exitCode = 1;
  } finally {
    try {
      await stopServer();
      if (owns) {
        await assertTarget();
        await source.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
        const [row] = await source.query(
          "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'",
        );
        assert.equal(row.count, 0);
        cleanup = 'Servidor encerrado, schema public vazio, advisory lock liberado e pool fechado';
      } else {
        cleanup =
          'Nenhuma limpeza de dados: destino não autorizado ou schema pré-existente preservado';
      }
    } catch (error) {
      fatal = error;
      process.exitCode = 1;
      cleanup = 'Falha: conferir recursos antes de remover o Compose';
    } finally {
      try {
        if (locked) await owner.query('SELECT pg_advisory_unlock(179158, 16)');
      } catch (error) {
        fatal ??= error;
        process.exitCode = 1;
        cleanup = 'Falha ao liberar advisory lock';
      }
      try {
        if (!owner.isReleased) await owner.release();
      } catch (error) {
        fatal ??= error;
        process.exitCode = 1;
        cleanup = 'Falha ao liberar conexão de controle';
      }
      try {
        if (source.isInitialized) await source.destroy();
      } catch (error) {
        fatal ??= error;
        process.exitCode = 1;
        cleanup = 'Falha ao encerrar pool';
      }
      writeReport(fatal);
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha no executor');
  process.exitCode = 1;
});
