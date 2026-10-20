import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { AppointmentController } from '../src/controllers/appointment.controller';
import { AuthController } from '../src/controllers/auth.controller';
import { DoctorController } from '../src/controllers/doctor.controller';
import { DoctorPlanningController } from '../src/controllers/doctor-planning.controller';
import { PatientController } from '../src/controllers/patient.controller';
import { UserController } from '../src/controllers/user.controller';
import { UserRole } from '../src/domain/user';
import { JwtTokenProvider } from '../src/infrastructure/jwt-token-provider';
import { createAuthMiddleware } from '../src/middlewares/auth.middleware';
import { AppointmentService } from '../src/services/appointment.service';
import { AuthService } from '../src/services/auth.service';
import { DoctorService } from '../src/services/doctor.service';
import { DoctorCalendarService } from '../src/services/doctor-calendar.service';
import { PatientService } from '../src/services/patient.service';
import { UserService } from '../src/services/user.service';
import { WorkScheduleService } from '../src/services/work-schedule.service';
import { admin } from './doubles';
import { createDoctorDoubles, doctor } from './doctor-doubles';
import {
  appointment,
  createAppointmentDoubles,
  createAppointmentInput,
} from './appointment-doubles';
import { createPatientDoubles } from './patient-doubles';
import { createPlanningDoubles } from './planning-doubles';
import { MedicalRecordController } from '../src/controllers/medical-record.controller';
import { MedicalRecordService } from '../src/services/medical-record.service';
import { createMedicalRecordDoubles } from './medical-record-doubles';

const domain = createDoctorDoubles();
const repository = createAppointmentDoubles();
const tokens = new JwtTokenProvider(
  'segredo-ficticio-http-de-consultas-com-mais-de-32-caracteres',
  3600,
);
const log = vi.fn();
let server: Server;
let base: string;

async function call(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    role?: UserRole;
    actorId?: string;
    anonymous?: boolean;
  } = {},
) {
  const headers: Record<string, string> = {};
  if (!options.anonymous) {
    const actorId =
      options.actorId ?? (options.role === UserRole.DOCTOR ? doctor.user.id : admin.id);
    headers.Authorization = `Bearer ${tokens.sign({ id: actorId, roles: [options.role ?? UserRole.ADMIN] })}`;
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}/api/v1/appointments${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: response.status, body: await response.json() };
}

beforeAll(async () => {
  const medical = createMedicalRecordDoubles();
  const planning = createPlanningDoubles();
  const schedules = planning.schedules;
  const appointments = createApp({
    authController: new AuthController(new AuthService(domain.users, domain.passwords, tokens)),
    userController: new UserController(new UserService(domain.users, domain.passwords)),
    patientController: new PatientController(new PatientService(createPatientDoubles())),
    doctorController: new DoctorController(
      new DoctorService(domain.doctors, domain.users, domain.passwords),
    ),
    doctorPlanningController: new DoctorPlanningController(
      new WorkScheduleService(planning.doctors, schedules),
      new DoctorCalendarService(planning.doctors, schedules, planning.appointments),
    ),
    appointmentController: new AppointmentController(
      new AppointmentService(repository.appointments, domain.doctors),
    ),
    medicalRecordController: new MedicalRecordController(
      new MedicalRecordService(medical.records, medical.patients, medical.doctors),
    ),
    authenticate: createAuthMiddleware(tokens),
    logError: log,
  });
  await new Promise<void>((resolve) => {
    server = appointments.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Porta indisponível');
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

beforeEach(() => {
  vi.clearAllMocks();
  repository.state.failure = null;
  repository.bookingCalls.length = 0;
  repository.exists.doctor = true;
  repository.exists.patient = true;
  repository.transaction.getWorkShifts.mockResolvedValue([
    { weekDay: 2, startTime: '08:00', endTime: '12:00', slotDurationMinutes: 30 },
  ]);
  repository.transaction.hasDoctorConflict.mockResolvedValue(false);
  repository.transaction.hasPatientConflict.mockResolvedValue(false);
  repository.transaction.create.mockResolvedValue(appointment);
  repository.appointments.findById.mockResolvedValue(appointment);
  repository.appointments.list.mockResolvedValue({ items: [appointment], total: 1 });
  repository.appointments.updateStatusIfCurrent.mockResolvedValue(true);
  domain.doctors.findByUserId.mockResolvedValue(doctor);
});

describe('Contrato HTTP de agendamentos', () => {
  it('exige autenticação e limita criação a admin/secretary', async () => {
    expect(
      await call('', { method: 'POST', body: createAppointmentInput, anonymous: true }),
    ).toMatchObject({ status: 401 });
    expect(
      await call('', { method: 'POST', body: createAppointmentInput, role: UserRole.DOCTOR }),
    ).toMatchObject({ status: 403, body: { error: 'ACESSO_NEGADO' } });
  });
  it.each([
    {},
    { ...createAppointmentInput, doctorId: 'invalid' },
    { ...createAppointmentInput, startsAt: '2026-10-20T08:00:00' },
    { ...createAppointmentInput, startsAt: 'not-a-date' },
    { ...createAppointmentInput, endsAt: '2026-10-20T08:30:00-03:00' },
    { ...createAppointmentInput, extra: true },
  ])('recusa corpo inválido antes da transação: %j', async (body) => {
    expect(await call('', { method: 'POST', body })).toMatchObject({
      status: 400,
      body: { error: 'DADOS_INVALIDOS' },
    });
    expect(repository.bookingCalls).toHaveLength(0);
  });
  it('cria consulta e responde com período calculado em UTC', async () => {
    expect(await call('', { method: 'POST', body: createAppointmentInput })).toEqual({
      status: 201,
      body: {
        id: appointment.id,
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        startsAt: '2026-10-20T11:00:00.000Z',
        endsAt: '2026-10-20T11:30:00.000Z',
        status: 'scheduled',
      },
    });
  });
  it.each([
    ['missing', 404, 'RECURSO_NAO_ENCONTRADO'],
    ['outside', 422, 'HORARIO_FORA_DA_ESCALA'],
    ['doctor-conflict', 409, 'HORARIO_INDISPONIVEL'],
    ['patient-conflict', 409, 'PACIENTE_INDISPONIVEL'],
  ] as const)('traduz %s pela fronteira HTTP', async (scenario, status, code) => {
    if (scenario === 'missing') repository.exists.doctor = false;
    if (scenario === 'outside') repository.transaction.getWorkShifts.mockResolvedValue([]);
    if (scenario === 'doctor-conflict')
      repository.transaction.hasDoctorConflict.mockResolvedValue(true);
    if (scenario === 'patient-conflict')
      repository.transaction.hasPatientConflict.mockResolvedValue(true);
    expect(await call('', { method: 'POST', body: createAppointmentInput })).toMatchObject({
      status,
      body: { statusCode: status, error: code },
    });
  });
  it('lista com filtros e data/meta; força o médico autenticado', async () => {
    const result = await call(
      '?doctorId=338e7dbe-0f78-4d60-9de4-ab92a20de060&from=2026-10-20&to=2026-10-20&page=2&pageSize=5',
      { role: UserRole.DOCTOR },
    );
    expect(result).toMatchObject({
      status: 200,
      body: {
        data: [{ id: appointment.id }],
        meta: { total: 1, page: 2, pageSize: 5, totalPages: 1 },
      },
    });
    expect(repository.appointments.list).toHaveBeenCalledWith({
      doctorId: doctor.id,
      from: '2026-10-20',
      to: '2026-10-20',
      page: 2,
      pageSize: 5,
      fromInclusive: new Date('2026-10-20T03:00:00Z'),
      toExclusive: new Date('2026-10-21T03:00:00Z'),
    });
  });
  it('doctor que pede outro doctorId recebe página vazia', async () => {
    expect(
      await call('?doctorId=c412f72a-6f13-4e4f-b659-8ac1b413947c', { role: UserRole.DOCTOR }),
    ).toMatchObject({ status: 200, body: { data: [], meta: { total: 0 } } });
    expect(repository.appointments.list).not.toHaveBeenCalled();
  });
  it.each([
    '?doctorId=invalid',
    '?status=unknown',
    '?page=0',
    '?pageSize=101',
    '?from=2026-02-30',
    '?from=2026-10-21&to=2026-10-20',
  ])('recusa query inválida %s', async (query) => {
    expect(await call(query)).toMatchObject({ status: 400, body: { error: 'DADOS_INVALIDOS' } });
  });
  it('consulta individual aplica posse e 404', async () => {
    expect(await call(`/${appointment.id}`, { role: UserRole.DOCTOR })).toMatchObject({
      status: 200,
      body: { doctorId: doctor.id },
    });
    domain.doctors.findByUserId.mockResolvedValue({ ...doctor, id: 'another-doctor' });
    expect(await call(`/${appointment.id}`, { role: UserRole.DOCTOR })).toMatchObject({
      status: 403,
      body: { error: 'ACESSO_NEGADO' },
    });
    repository.appointments.findById.mockResolvedValue(null);
    expect(await call(`/${appointment.id}`)).toMatchObject({
      status: 404,
      body: { error: 'RECURSO_NAO_ENCONTRADO' },
    });
  });
  it('atualiza status permitido; centraliza transição, permissão e entrada inválida', async () => {
    expect(
      await call(`/${appointment.id}/status`, { method: 'PATCH', body: { status: 'in_progress' } }),
    ).toMatchObject({ status: 200, body: { status: 'in_progress' } });
    expect(
      await call(`/${appointment.id}/status`, { method: 'PATCH', body: { status: 'done' } }),
    ).toMatchObject({ status: 422, body: { error: 'TRANSICAO_INVALIDA' } });
    expect(
      await call(`/${appointment.id}/status`, {
        method: 'PATCH',
        body: { status: 'cancelled' },
        role: UserRole.SECRETARY,
      }),
    ).toMatchObject({ status: 200, body: { status: 'cancelled' } });
    expect(
      await call(`/${appointment.id}/status`, { method: 'PATCH', body: { status: 'unknown' } }),
    ).toMatchObject({ status: 400, body: { error: 'DADOS_INVALIDOS' } });
    expect(
      await call(`/${appointment.id}/status`, {
        method: 'PATCH',
        body: { status: 'in_progress' },
        role: UserRole.SECRETARY,
      }),
    ).toMatchObject({ status: 403, body: { error: 'ACESSO_NEGADO' } });
  });
  it('deixa erro inesperado para o middleware central', async () => {
    repository.state.failure = new Error('Falha no banco');
    expect(await call('', { method: 'POST', body: createAppointmentInput })).toMatchObject({
      status: 500,
      body: { error: 'ERRO_INTERNO' },
    });
    expect(log).toHaveBeenCalledOnce();
  });
});
