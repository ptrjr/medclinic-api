import { describe, expect, it } from 'vitest';
import { AppointmentStatus, type AppointmentListQuery } from '../src/domain/appointment';
import { UserRole } from '../src/domain/user';
import { AppointmentService } from '../src/services/appointment.service';
import {
  assertCanTransition,
  calculateAppointmentEnd,
} from '../src/rules/appointment-schedule.rules';
import { admin } from './doubles';
import { createDoctorDoubles, doctor } from './doctor-doubles';
import {
  appointment,
  createAppointmentDoubles,
  createAppointmentInput,
} from './appointment-doubles';
import { shift } from './planning-doubles';

const startsAt = new Date('2026-10-20T11:00:00.000Z');

describe('Regras do horário de consulta', () => {
  it('converte o instante para hora local e calcula o fim pelo turno', () => {
    expect(calculateAppointmentEnd(startsAt, [shift])).toEqual(
      new Date('2026-10-20T11:30:00.000Z'),
    );
  });
  it('aceita consulta que termina exatamente no fim do turno', () => {
    expect(
      calculateAppointmentEnd(new Date('2026-10-20T13:30:00Z'), [{ ...shift, endTime: '11:00' }]),
    ).toEqual(new Date('2026-10-20T14:00:00Z'));
  });
  it.each([
    new Date('2026-10-20T15:00:00Z'),
    new Date('2026-10-21T11:00:00Z'),
    new Date('2026-10-20T11:00:30Z'),
    new Date('2026-10-20T11:00:00.001Z'),
  ])('recusa instante fora da escala ou da precisão de minuto: %s', (instant) => {
    expect(() => calculateAppointmentEnd(instant, [shift])).toThrowError(
      expect.objectContaining({ code: 'HORARIO_FORA_DA_ESCALA' }),
    );
  });
  it('recusa horário entre os pontos da grade do turno', () => {
    expect(() => calculateAppointmentEnd(new Date('2026-10-20T11:15:00Z'), [shift])).toThrowError(
      expect.objectContaining({ code: 'HORARIO_FORA_DA_ESCALA' }),
    );
  });
  it('recusa consulta que ultrapassa o fim do turno', () => {
    expect(() =>
      calculateAppointmentEnd(new Date('2026-10-20T11:30:00Z'), [{ ...shift, endTime: '08:50' }]),
    ).toThrowError(expect.objectContaining({ code: 'HORARIO_FORA_DA_ESCALA' }));
  });
});

describe('Regras de transição de status', () => {
  it('admin inicia uma consulta agendada', () => {
    expect(() =>
      assertCanTransition(AppointmentStatus.SCHEDULED, AppointmentStatus.IN_PROGRESS, admin, false),
    ).not.toThrow();
  });
  it('secretary cancela consulta agendada', () => {
    expect(() =>
      assertCanTransition(
        AppointmentStatus.SCHEDULED,
        AppointmentStatus.CANCELLED,
        { id: 'secretary', roles: [UserRole.SECRETARY] },
        false,
      ),
    ).not.toThrow();
  });
  it.each([
    [AppointmentStatus.SCHEDULED, AppointmentStatus.IN_PROGRESS],
    [AppointmentStatus.SCHEDULED, AppointmentStatus.CANCELLED],
    [AppointmentStatus.IN_PROGRESS, AppointmentStatus.DONE],
    [AppointmentStatus.IN_PROGRESS, AppointmentStatus.CANCELLED],
  ] as const)('doctor da consulta executa %s → %s', (current, next) => {
    expect(() =>
      assertCanTransition(current, next, { id: 'doctor', roles: [UserRole.DOCTOR] }, true),
    ).not.toThrow();
  });
  it('recusa transição fora do ciclo antes de checar permissão', () => {
    expect(() =>
      assertCanTransition(
        AppointmentStatus.DONE,
        AppointmentStatus.CANCELLED,
        { id: 'secretary', roles: [UserRole.SECRETARY] },
        false,
      ),
    ).toThrowError(expect.objectContaining({ code: 'TRANSICAO_INVALIDA' }));
  });
  it('recusa doctor sem posse e secretary tentando cancelar consulta em andamento', () => {
    expect(() =>
      assertCanTransition(
        AppointmentStatus.SCHEDULED,
        AppointmentStatus.IN_PROGRESS,
        { id: 'other-doctor', roles: [UserRole.DOCTOR] },
        false,
      ),
    ).toThrowError(expect.objectContaining({ code: 'ACESSO_NEGADO' }));
    expect(() =>
      assertCanTransition(
        AppointmentStatus.IN_PROGRESS,
        AppointmentStatus.CANCELLED,
        { id: 'secretary', roles: [UserRole.SECRETARY] },
        false,
      ),
    ).toThrowError(expect.objectContaining({ code: 'ACESSO_NEGADO' }));
  });
});

const defaultQuery: AppointmentListQuery = { page: 1, pageSize: 20 };
const secretary = { id: 'secretary-id', roles: [UserRole.SECRETARY] };
const doctorActor = { id: doctor.user.id, roles: [UserRole.DOCTOR] };

function fixture() {
  const repository = createAppointmentDoubles();
  const doctors = createDoctorDoubles().doctors;
  repository.state.failure = null;
  repository.bookingCalls.length = 0;
  return {
    ...repository,
    doctors,
    service: new AppointmentService(repository.appointments, doctors),
  };
}

describe('AppointmentService.create', () => {
  it('valida e cria dentro do contexto de bloqueio com endsAt calculado', async () => {
    const f = fixture();
    await expect(f.service.create(createAppointmentInput, admin)).resolves.toEqual({
      id: appointment.id,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
      status: 'scheduled',
    });
    expect(f.bookingCalls).toEqual([
      { doctorId: appointment.doctorId, patientId: appointment.patientId },
    ]);
    expect(f.transaction.getWorkShifts).toHaveBeenCalledOnce();
    expect(f.transaction.hasDoctorConflict).toHaveBeenCalledWith(
      appointment.startsAt,
      appointment.endsAt,
    );
    expect(f.transaction.hasPatientConflict).toHaveBeenCalledWith(
      appointment.startsAt,
      appointment.endsAt,
    );
    expect(f.transaction.create).toHaveBeenCalledWith({
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
    });
  });
  it('permite secretary e recusa outros perfis antes de abrir transação', async () => {
    const f = fixture();
    await expect(f.service.create(createAppointmentInput, secretary)).resolves.toBeDefined();
    await expect(f.service.create(createAppointmentInput, doctorActor)).rejects.toMatchObject({
      code: 'ACESSO_NEGADO',
    });
    expect(f.bookingCalls).toHaveLength(1);
  });
  it.each([
    ['doctor', false],
    ['patient', true],
  ] as const)('retorna 404 quando %s não existe', async (resource, missingPatient) => {
    const f = fixture();
    if (missingPatient) {
      f.exists.patient = false;
    } else {
      f.exists.doctor = false;
    }
    await expect(f.service.create(createAppointmentInput, admin)).rejects.toMatchObject({
      code: 'RECURSO_NAO_ENCONTRADO',
    });
    expect(f.transaction.getWorkShifts).not.toHaveBeenCalled();
    expect(f.transaction.create).not.toHaveBeenCalled();
    expect(resource).toBeDefined();
  });
  it('valida horário da escala antes de procurar conflitos', async () => {
    const f = fixture();
    f.transaction.getWorkShifts.mockResolvedValue([]);
    await expect(f.service.create(createAppointmentInput, admin)).rejects.toMatchObject({
      code: 'HORARIO_FORA_DA_ESCALA',
    });
    expect(f.transaction.hasDoctorConflict).not.toHaveBeenCalled();
  });
  it('prioriza conflito do médico sobre conflito do paciente', async () => {
    const f = fixture();
    f.transaction.hasDoctorConflict.mockResolvedValue(true);
    f.transaction.hasPatientConflict.mockResolvedValue(true);
    await expect(f.service.create(createAppointmentInput, admin)).rejects.toMatchObject({
      code: 'HORARIO_INDISPONIVEL',
    });
    expect(f.transaction.hasPatientConflict).not.toHaveBeenCalled();
    expect(f.transaction.create).not.toHaveBeenCalled();
  });
  it('recusa conflito do paciente depois de médico livre', async () => {
    const f = fixture();
    f.transaction.hasPatientConflict.mockResolvedValue(true);
    await expect(f.service.create(createAppointmentInput, secretary)).rejects.toMatchObject({
      code: 'PACIENTE_INDISPONIVEL',
    });
    expect(f.transaction.create).not.toHaveBeenCalled();
  });
});

describe('AppointmentService.list', () => {
  it('devolve lista e metadados para admin', async () => {
    const f = fixture();
    await expect(f.service.list({ page: 2, pageSize: 10 }, admin)).resolves.toEqual({
      data: [
        {
          id: appointment.id,
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          startsAt: appointment.startsAt.toISOString(),
          endsAt: appointment.endsAt.toISOString(),
          status: 'scheduled',
        },
      ],
      meta: { total: 1, page: 2, pageSize: 10, totalPages: 1 },
    });
  });
  it('força doctorId próprio e conserva os outros filtros', async () => {
    const f = fixture();
    const query = { ...defaultQuery, patientId: appointment.patientId };
    await f.service.list(query, doctorActor);
    expect(f.appointments.list).toHaveBeenCalledWith({ ...query, doctorId: doctor.id });
  });
  it('doctor sem registro ou pedindo outro médico recebe lista vazia', async () => {
    const f = fixture();
    f.doctors.findByUserId.mockResolvedValue(null);
    await expect(f.service.list(defaultQuery, doctorActor)).resolves.toMatchObject({
      data: [],
      meta: { total: 0, totalPages: 0 },
    });
    f.doctors.findByUserId.mockResolvedValue(doctor);
    await expect(
      f.service.list(
        { ...defaultQuery, doctorId: 'c412f72a-6f13-4e4f-b659-8ac1b413947c' },
        doctorActor,
      ),
    ).resolves.toMatchObject({ data: [] });
    expect(f.appointments.list).not.toHaveBeenCalled();
  });
  it('admin com perfil doctor não sofre filtro forçado', async () => {
    const f = fixture();
    await f.service.list(defaultQuery, { id: admin.id, roles: [UserRole.DOCTOR, UserRole.ADMIN] });
    expect(f.doctors.findByUserId).not.toHaveBeenCalled();
    expect(f.appointments.list).toHaveBeenCalledWith(defaultQuery);
  });
});

describe('AppointmentService.getById', () => {
  it('retorna agendamento ao médico dono e admin', async () => {
    const f = fixture();
    await expect(f.service.getById(appointment.id, doctorActor)).resolves.toMatchObject({
      id: appointment.id,
      doctorId: appointment.doctorId,
    });
    await expect(f.service.getById(appointment.id, admin)).resolves.toBeDefined();
  });
  it('recusa médico alheio e agendamento inexistente', async () => {
    const f = fixture();
    f.doctors.findByUserId.mockResolvedValue({ ...doctor, id: 'another-doctor' });
    await expect(f.service.getById(appointment.id, doctorActor)).rejects.toMatchObject({
      code: 'ACESSO_NEGADO',
    });
    f.appointments.findById.mockResolvedValue(null);
    await expect(f.service.getById(appointment.id, secretary)).rejects.toMatchObject({
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  });
});

describe('AppointmentService.changeStatus', () => {
  it('faz transição válida e devolve estado novo', async () => {
    const f = fixture();
    await expect(
      f.service.changeStatus(appointment.id, AppointmentStatus.IN_PROGRESS, admin),
    ).resolves.toMatchObject({ status: 'in_progress' });
    expect(f.appointments.updateStatusIfCurrent).toHaveBeenCalledWith(
      appointment.id,
      AppointmentStatus.SCHEDULED,
      AppointmentStatus.IN_PROGRESS,
    );
  });
  it('recusa transição inválida, permissão e corrida de status', async () => {
    const f = fixture();
    await expect(
      f.service.changeStatus(appointment.id, AppointmentStatus.DONE, secretary),
    ).rejects.toMatchObject({ code: 'TRANSICAO_INVALIDA' });
    await expect(
      f.service.changeStatus(appointment.id, AppointmentStatus.IN_PROGRESS, secretary),
    ).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
    f.appointments.updateStatusIfCurrent.mockResolvedValue(false);
    await expect(
      f.service.changeStatus(appointment.id, AppointmentStatus.CANCELLED, admin),
    ).rejects.toMatchObject({ code: 'TRANSICAO_INVALIDA' });
    f.appointments.findById.mockResolvedValue(null);
    await expect(
      f.service.changeStatus(appointment.id, AppointmentStatus.CANCELLED, admin),
    ).rejects.toMatchObject({ code: 'RECURSO_NAO_ENCONTRADO' });
  });
  it('recusa doctor que não possui a consulta ao tentar mudar status', async () => {
    const f = fixture();
    f.doctors.findByUserId.mockResolvedValue({ ...doctor, id: 'another-doctor' });
    await expect(
      f.service.changeStatus(appointment.id, AppointmentStatus.IN_PROGRESS, doctorActor),
    ).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
  });
});
