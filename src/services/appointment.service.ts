import {
  AppointmentStatus,
  type Appointment,
  type AppointmentListQuery,
} from '../domain/appointment';
import { UserRole, type AuthPrincipal } from '../domain/user';
import {
  toAppointmentResponse,
  type AppointmentListResponse,
  type CreateAppointmentInput,
} from '../dtos/appointment.dto';
import { AppError } from '../errors/app-error';
import type { AppointmentRepositoryPort } from '../ports/appointment-repository.port';
import type { DoctorRepositoryPort } from '../ports/doctor-repository.port';
import {
  assertCanTransition,
  calculateAppointmentEnd,
  periodsOverlap,
} from '../rules/appointment-schedule.rules';

export class AppointmentService {
  constructor(
    private readonly appointments: AppointmentRepositoryPort,
    private readonly doctors: DoctorRepositoryPort,
  ) {}

  public async create(input: CreateAppointmentInput, actor: AuthPrincipal) {
    if (!actor.roles.includes(UserRole.ADMIN) && !actor.roles.includes(UserRole.SECRETARY)) {
      throw new AppError('ACESSO_NEGADO', 'Somente admin ou secretary pode agendar consultas.');
    }
    const startsAt = new Date(input.startsAt);
    return this.appointments.withBookingLocks(
      input.doctorId,
      input.patientId,
      async (transaction) => {
        if (!transaction.doctorExists || !transaction.patientExists) {
          throw new AppError('RECURSO_NAO_ENCONTRADO', 'Médico ou paciente não encontrado.');
        }
        const shifts = await transaction.getWorkShifts();
        const endsAt = calculateAppointmentEnd(startsAt, shifts);
        const period = { startsAt, endsAt };
        const doctorCandidates = await transaction.findDoctorConflictCandidates(startsAt, endsAt);
        if (doctorCandidates.some((candidate) => periodsOverlap(period, candidate))) {
          throw new AppError('HORARIO_INDISPONIVEL', 'Horário indisponível para o médico.');
        }
        const patientCandidates = await transaction.findPatientConflictCandidates(startsAt, endsAt);
        if (patientCandidates.some((candidate) => periodsOverlap(period, candidate))) {
          throw new AppError('PACIENTE_INDISPONIVEL', 'Paciente indisponível nesse horário.');
        }
        return toAppointmentResponse(await transaction.create({ ...input, startsAt, endsAt }));
      },
    );
  }

  public async list(
    query: AppointmentListQuery,
    actor: AuthPrincipal,
  ): Promise<AppointmentListResponse> {
    let effectiveQuery = query;
    if (actor.roles.includes(UserRole.DOCTOR) && !actor.roles.includes(UserRole.ADMIN)) {
      const doctor = await this.doctors.findByUserId(actor.id);
      if (!doctor || (query.doctorId && query.doctorId !== doctor.id)) {
        return this.emptyPage(query);
      }
      effectiveQuery = { ...query, doctorId: doctor.id };
    }
    const page = await this.appointments.list(effectiveQuery);
    return {
      data: page.items.map(toAppointmentResponse),
      meta: {
        total: page.total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(page.total / query.pageSize),
      },
    };
  }

  public async getById(id: string, actor: AuthPrincipal) {
    const appointment = await this.requireAppointment(id);
    if (actor.roles.includes(UserRole.DOCTOR) && !actor.roles.includes(UserRole.ADMIN)) {
      const doctor = await this.doctors.findByUserId(actor.id);
      if (!doctor || doctor.id !== appointment.doctorId) {
        throw new AppError(
          'ACESSO_NEGADO',
          'Médico não pode consultar agendamento de outro médico.',
        );
      }
    }
    return toAppointmentResponse(appointment);
  }

  public async changeStatus(id: string, nextStatus: AppointmentStatus, actor: AuthPrincipal) {
    const appointment = await this.requireAppointment(id);
    let ownsAppointment = false;
    if (actor.roles.includes(UserRole.DOCTOR)) {
      const doctor = await this.doctors.findByUserId(actor.id);
      ownsAppointment = doctor?.id === appointment.doctorId;
    }
    assertCanTransition(appointment.status, nextStatus, actor, ownsAppointment);
    const updated = await this.appointments.updateStatusIfCurrent(
      id,
      appointment.status,
      nextStatus,
    );
    if (!updated) {
      throw new AppError(
        'TRANSICAO_INVALIDA',
        'A consulta mudou de estado; atualize e tente novamente.',
      );
    }
    return toAppointmentResponse({ ...appointment, status: nextStatus });
  }

  private async requireAppointment(id: string): Promise<Appointment> {
    const appointment = await this.appointments.findById(id);
    if (!appointment) throw new AppError('RECURSO_NAO_ENCONTRADO', 'Agendamento não encontrado.');
    return appointment;
  }

  private emptyPage(query: AppointmentListQuery): AppointmentListResponse {
    return {
      data: [],
      meta: { total: 0, page: query.page, pageSize: query.pageSize, totalPages: 0 },
    };
  }
}
