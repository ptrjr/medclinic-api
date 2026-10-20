import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { AuthController } from '../src/controllers/auth.controller';
import { UserController } from '../src/controllers/user.controller';
import { PatientController } from '../src/controllers/patient.controller';
import { DoctorController } from '../src/controllers/doctor.controller';
import { DoctorPlanningController } from '../src/controllers/doctor-planning.controller';
import { AppointmentController } from '../src/controllers/appointment.controller';
import { DoctorCalendarService } from '../src/services/doctor-calendar.service';
import { WorkScheduleService } from '../src/services/work-schedule.service';
import { AuthService } from '../src/services/auth.service';
import { UserService } from '../src/services/user.service';
import { PatientService } from '../src/services/patient.service';
import { DoctorService } from '../src/services/doctor.service';
import { AppointmentService } from '../src/services/appointment.service';
import { UserRole } from '../src/domain/user';
import { JwtTokenProvider } from '../src/infrastructure/jwt-token-provider';
import { createAuthMiddleware } from '../src/middlewares/auth.middleware';
import { createPatientDoubles } from './patient-doubles';
import { admin } from './doubles';
import { doctor } from './doctor-doubles';
import { consultation, createPlanningDoubles, shift } from './planning-doubles';
import { createAppointmentDoubles } from './appointment-doubles';
import { MedicalRecordController } from '../src/controllers/medical-record.controller';
import { MedicalRecordService } from '../src/services/medical-record.service';
import { createMedicalRecordDoubles } from './medical-record-doubles';

const f = createPlanningDoubles();
const tokens = new JwtTokenProvider('segredo-ficticio-http-para-escalas-e-agenda', 3600);
const log = vi.fn();
let server: Server;
let base: string;
const schedulePath = `/${doctor.id}/work-schedule`;
const calendarPath = `/${doctor.id}/calendar`;
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
  const medical = createMedicalRecordDoubles();
  const app = createApp({
    authController: new AuthController(new AuthService(f.users, f.passwords, tokens)),
    userController: new UserController(new UserService(f.users, f.passwords)),
    patientController: new PatientController(new PatientService(createPatientDoubles())),
    doctorController: new DoctorController(new DoctorService(f.doctors, f.users, f.passwords)),
    doctorPlanningController: new DoctorPlanningController(
      new WorkScheduleService(f.doctors, f.schedules),
      new DoctorCalendarService(f.doctors, f.schedules, f.appointments),
    ),
    appointmentController: new AppointmentController(
      new AppointmentService(createAppointmentDoubles().appointments, f.doctors),
    ),
    medicalRecordController: new MedicalRecordController(
      new MedicalRecordService(medical.records, medical.patients, medical.doctors),
    ),
    authenticate: createAuthMiddleware(tokens),
    logError: log,
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
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
  f.doctors.findById.mockResolvedValue(doctor);
  f.schedules.getShifts.mockResolvedValue([shift]);
  f.schedules.replaceShifts.mockResolvedValue(undefined);
  f.appointments.listActiveForDoctor.mockResolvedValue([consultation]);
});

describe('Contrato HTTP de escala e agenda', () => {
  it.each([
    ['PUT', schedulePath],
    ['GET', schedulePath],
    ['GET', `${calendarPath}?from=2026-10-13&to=2026-10-13`],
  ])('%s %s exige token', async (method, path) => {
    expect(
      await call(path, {
        method,
        body: method === 'PUT' ? { shifts: [] } : undefined,
        anonymous: true,
      }),
    ).toMatchObject({ status: 401, body: { statusCode: 401, error: 'NAO_AUTENTICADO' } });
  });
  it('admin substitui a escala e recebe exatamente o corpo enviado', async () => {
    const body = {
      shifts: [shift, { ...shift, startTime: '14:00', endTime: '18:00', slotDurationMinutes: 20 }],
    };
    expect(await call(schedulePath, { method: 'PUT', body })).toEqual({ status: 200, body });
    expect(f.schedules.replaceShifts).toHaveBeenCalledWith(doctor.id, body.shifts);
  });
  it('admin apaga a escala com shifts vazio', async () => {
    expect(await call(schedulePath, { method: 'PUT', body: { shifts: [] } })).toEqual({
      status: 200,
      body: { shifts: [] },
    });
  });
  it.each([UserRole.SECRETARY, UserRole.DOCTOR])(
    '%s não altera escala, conforme seção detalhada do PUT',
    async (role) => {
      expect(
        await call(schedulePath, { method: 'PUT', role, body: { shifts: [shift] } }),
      ).toMatchObject({ status: 403, body: { error: 'ACESSO_NEGADO' } });
      expect(f.schedules.replaceShifts).not.toHaveBeenCalled();
    },
  );
  it.each([
    {},
    { shifts: null },
    { shifts: {} },
    { shifts: [{ ...shift, weekDay: -1 }] },
    { shifts: [{ ...shift, weekDay: 7 }] },
    { shifts: [{ ...shift, weekDay: 1.5 }] },
    { shifts: [{ ...shift, weekDay: '2' }] },
    { shifts: [{ ...shift, startTime: '8:00' }] },
    { shifts: [{ ...shift, endTime: '24:00' }] },
    { shifts: [{ ...shift, startTime: '12:00' }] },
    { shifts: [{ ...shift, endTime: '07:00' }] },
    { shifts: [{ ...shift, slotDurationMinutes: 0 }] },
    { shifts: [{ ...shift, slotDurationMinutes: -30 }] },
    { shifts: [{ ...shift, slotDurationMinutes: 1.5 }] },
    { shifts: [{ ...shift, slotDurationMinutes: '30' }] },
    { shifts: [shift, { ...shift, startTime: '11:00', endTime: '13:00' }] },
  ])('turno/corpo inválido retorna 400 e preserva escala: %j', async (body) => {
    expect(await call(schedulePath, { method: 'PUT', body })).toMatchObject({
      status: 400,
      body: { statusCode: 400, error: 'DADOS_INVALIDOS' },
    });
    expect(f.schedules.replaceShifts).not.toHaveBeenCalled();
  });
  it('aceita turnos encostados', async () => {
    const body = { shifts: [shift, { ...shift, startTime: '12:00', endTime: '18:00' }] };
    expect(await call(schedulePath, { method: 'PUT', body })).toEqual({ status: 200, body });
  });
  it.each([UserRole.ADMIN, UserRole.SECRETARY, UserRole.DOCTOR])(
    '%s consulta escala e agenda',
    async (role) => {
      expect(await call(schedulePath, { role })).toEqual({
        status: 200,
        body: { shifts: [shift] },
      });
      expect(await call(`${calendarPath}?from=2026-10-13&to=2026-10-13`, { role })).toEqual({
        status: 200,
        body: {
          workSchedule: { shifts: [shift] },
          appointments: [
            {
              id: consultation.id,
              patientId: consultation.patientId,
              startsAt: '2026-10-13T11:00:00.000Z',
              endsAt: '2026-10-13T11:30:00.000Z',
              status: 'scheduled',
            },
          ],
        },
      });
    },
  );
  it('sem escala retorna 200 e shifts vazio; sem consultas retorna appointments vazio', async () => {
    f.schedules.getShifts.mockResolvedValue([]);
    f.appointments.listActiveForDoctor.mockResolvedValue([]);
    expect(await call(schedulePath)).toEqual({ status: 200, body: { shifts: [] } });
    expect(await call(`${calendarPath}?from=2026-10-13&to=2026-10-13`)).toEqual({
      status: 200,
      body: { workSchedule: { shifts: [] }, appointments: [] },
    });
  });
  it.each([
    '',
    '?from=2026-10-13',
    '?to=2026-10-13',
    '?from=2026-2-01&to=2026-02-01',
    '?from=2026-02-30&to=2026-02-30',
    '?from=2026-10-14&to=2026-10-13',
    '?from=2026-10-01&to=2026-11-01',
  ])('recusa query inválida %s', async (query) => {
    expect(await call(calendarPath + query)).toMatchObject({
      status: 400,
      body: { error: 'DADOS_INVALIDOS' },
    });
    expect(f.appointments.listActiveForDoctor).not.toHaveBeenCalled();
  });
  it('aceita 31 dias e repassa limites UTC do dia local', async () => {
    expect((await call(`${calendarPath}?from=2026-10-01&to=2026-10-31`)).status).toBe(200);
    expect(f.appointments.listActiveForDoctor).toHaveBeenCalledWith(
      doctor.id,
      new Date('2026-10-01T03:00:00Z'),
      new Date('2026-11-01T03:00:00Z'),
    );
  });
  it.each([
    ['GET', schedulePath],
    ['PUT', schedulePath],
    ['GET', `${calendarPath}?from=2026-10-13&to=2026-10-13`],
  ])('%s %s retorna 404 para médico inexistente', async (method, path) => {
    f.doctors.findById.mockResolvedValue(null);
    expect(
      await call(path, { method, body: method === 'PUT' ? { shifts: [] } : undefined }),
    ).toMatchObject({ status: 404, body: { error: 'RECURSO_NAO_ENCONTRADO' } });
  });
  it('UUID malformado devolve 400', async () => {
    expect(await call('/invalid/work-schedule')).toMatchObject({
      status: 400,
      body: { error: 'DADOS_INVALIDOS' },
    });
  });
  it('falha de persistência passa pelo único middleware de erro', async () => {
    const error = new Error('Falha de teste');
    f.schedules.replaceShifts.mockRejectedValue(error);
    expect(await call(schedulePath, { method: 'PUT', body: { shifts: [] } })).toMatchObject({
      status: 500,
      body: { error: 'ERRO_INTERNO' },
    });
    expect(log).toHaveBeenCalledWith(error);
  });
  it('as rotas antigas de médicos continuam acessíveis', async () => {
    expect((await call(`/${doctor.id}`)).status).toBe(200);
  });
});
