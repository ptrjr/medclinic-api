import type { CalendarAppointment } from '../domain/appointment';

export interface CalendarAppointmentsPort {
  // Retorna consultas não canceladas que intersectam [fromInclusive, toExclusive).
  listActiveForDoctor(
    doctorId: string,
    fromInclusive: Date,
    toExclusive: Date,
  ): Promise<CalendarAppointment[]>;
}
