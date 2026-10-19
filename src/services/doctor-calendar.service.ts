import type { CalendarQuery, CalendarResponse } from '../dtos/calendar.dto';
import { AppError } from '../errors/app-error';
import type { DoctorRepositoryPort } from '../ports/doctor-repository.port';
import type { WorkScheduleRepositoryPort } from '../ports/work-schedule-repository.port';
import type { CalendarAppointmentsPort } from '../ports/calendar-appointments.port';
import { calendarPeriod } from '../rules/calendar-period.rules';

export class DoctorCalendarService {
  constructor(
    private readonly doctors: DoctorRepositoryPort,
    private readonly schedules: WorkScheduleRepositoryPort,
    private readonly appointments: CalendarAppointmentsPort,
  ) {}

  public async get(doctorId: string, query: CalendarQuery): Promise<CalendarResponse> {
    const period = calendarPeriod(query.from, query.to);
    if (!(await this.doctors.findById(doctorId)))
      throw new AppError('RECURSO_NAO_ENCONTRADO', 'Médico não encontrado.');
    const shifts = await this.schedules.getShifts(doctorId);
    const appointments = await this.appointments.listActiveForDoctor(
      doctorId,
      period.fromInclusive,
      period.toExclusive,
    );
    return {
      workSchedule: { shifts },
      appointments: appointments.map((appointment) => ({
        id: appointment.id,
        patientId: appointment.patientId,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        status: appointment.status,
      })),
    };
  }
}
