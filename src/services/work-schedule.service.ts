import { UserRole, type AuthPrincipal } from '../domain/user';
import type { WorkSchedule } from '../domain/work-schedule';
import { AppError } from '../errors/app-error';
import type { DoctorRepositoryPort } from '../ports/doctor-repository.port';
import type { WorkScheduleRepositoryPort } from '../ports/work-schedule-repository.port';
import { assertValidWorkShifts } from '../rules/work-schedule.rules';

export class WorkScheduleService {
  constructor(
    private readonly doctors: DoctorRepositoryPort,
    private readonly schedules: WorkScheduleRepositoryPort,
  ) {}

  public async replace(
    doctorId: string,
    schedule: WorkSchedule,
    actor: AuthPrincipal,
  ): Promise<WorkSchedule> {
    if (!actor.roles.includes(UserRole.ADMIN))
      throw new AppError('ACESSO_NEGADO', 'Somente admin pode alterar escalas.');
    await this.requireDoctor(doctorId);
    assertValidWorkShifts(schedule.shifts);
    const shifts = schedule.shifts.map((shift) => ({ ...shift }));
    await this.schedules.replaceShifts(doctorId, shifts);
    return { shifts };
  }

  public async get(doctorId: string): Promise<WorkSchedule> {
    await this.requireDoctor(doctorId);
    return { shifts: await this.schedules.getShifts(doctorId) };
  }

  private async requireDoctor(id: string): Promise<void> {
    if (!(await this.doctors.findById(id)))
      throw new AppError('RECURSO_NAO_ENCONTRADO', 'Médico não encontrado.');
  }
}
