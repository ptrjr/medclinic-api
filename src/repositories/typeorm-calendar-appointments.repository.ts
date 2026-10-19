import type { Repository } from 'typeorm';
import { AppointmentStatus, type CalendarAppointment } from '../domain/appointment';
import { AppointmentEntity } from '../entities/appointment.entity';
import type { CalendarAppointmentsPort } from '../ports/calendar-appointments.port';

export class TypeOrmCalendarAppointmentsRepository implements CalendarAppointmentsPort {
  constructor(private readonly appointments: Repository<AppointmentEntity>) {}

  public async listActiveForDoctor(
    doctorId: string,
    fromInclusive: Date,
    toExclusive: Date,
  ): Promise<CalendarAppointment[]> {
    const appointments = await this.appointments
      .createQueryBuilder('appointment')
      .where('appointment.doctorId = :doctorId', { doctorId })
      .andWhere('appointment.status <> :cancelled', { cancelled: AppointmentStatus.CANCELLED })
      .andWhere('appointment.startsAt < :toExclusive', { toExclusive })
      .andWhere('appointment.endsAt > :fromInclusive', { fromInclusive })
      .orderBy('appointment.startsAt', 'ASC')
      .addOrderBy('appointment.id', 'ASC')
      .getMany();
    return appointments.map((appointment) => ({
      id: appointment.id,
      patientId: appointment.patientId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
    }));
  }
}
