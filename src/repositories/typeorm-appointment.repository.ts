import { randomUUID } from 'node:crypto';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import {
  AppointmentStatus,
  type Appointment,
  type AppointmentListQuery,
  type AppointmentPage,
  type AppointmentPeriod,
  type NewAppointment,
} from '../domain/appointment';
import { AppointmentEntity } from '../entities/appointment.entity';
import { DoctorEntity } from '../entities/doctor.entity';
import { PatientEntity } from '../entities/patient.entity';
import { WorkScheduleEntity } from '../entities/work-schedule.entity';
import type {
  AppointmentBookingTransactionPort,
  AppointmentRepositoryPort,
} from '../ports/appointment-repository.port';

export class TypeOrmAppointmentRepository implements AppointmentRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  public async withBookingLocks<T>(
    doctorId: string,
    patientId: string,
    operation: (transaction: AppointmentBookingTransactionPort) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      // All appointment writers lock doctor first, then patient. The patient lock
      // also serializes bookings with different doctors for the same patient.
      const doctor = await manager
        .getRepository(DoctorEntity)
        .findOne({ where: { id: doctorId }, lock: { mode: 'pessimistic_write' } });
      const patient = await manager
        .getRepository(PatientEntity)
        .createQueryBuilder('patient')
        .where('patient.id = :patientId', { patientId })
        .andWhere('patient.deletedAt IS NULL')
        .setLock('pessimistic_write')
        .getOne();
      const appointments = manager.getRepository(AppointmentEntity);
      const transaction: AppointmentBookingTransactionPort = {
        doctorExists: doctor !== null,
        patientExists: patient !== null,
        getWorkShifts: async () =>
          (await manager.getRepository(WorkScheduleEntity).findOneBy({ doctorId }))?.shifts ?? [],
        findDoctorConflictCandidates: (startsAt, endsAt) =>
          this.findConflictCandidates(appointments, 'doctorId', doctorId, startsAt, endsAt),
        findPatientConflictCandidates: (startsAt, endsAt) =>
          this.findConflictCandidates(appointments, 'patientId', patientId, startsAt, endsAt),
        create: (input) => this.create(manager, input),
      };
      return operation(transaction);
    });
  }

  public async findById(id: string): Promise<Appointment | null> {
    const appointment = await this.dataSource.getRepository(AppointmentEntity).findOneBy({ id });
    return appointment ? this.toAppointment(appointment) : null;
  }

  public async list(query: AppointmentListQuery): Promise<AppointmentPage> {
    const builder = this.dataSource
      .getRepository(AppointmentEntity)
      .createQueryBuilder('appointment')
      .where('1 = 1');
    if (query.doctorId)
      builder.andWhere('appointment.doctorId = :doctorId', { doctorId: query.doctorId });
    if (query.patientId)
      builder.andWhere('appointment.patientId = :patientId', { patientId: query.patientId });
    if (query.status) builder.andWhere('appointment.status = :status', { status: query.status });
    if (query.fromInclusive) {
      builder.andWhere('appointment.startsAt >= :fromInclusive', {
        fromInclusive: query.fromInclusive,
      });
    }
    if (query.toExclusive) {
      builder.andWhere('appointment.startsAt < :toExclusive', { toExclusive: query.toExclusive });
    }
    const [items, total] = await builder
      .orderBy('appointment.startsAt', 'ASC')
      .addOrderBy('appointment.id', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return { items: items.map((item) => this.toAppointment(item)), total };
  }

  public async updateStatusIfCurrent(
    id: string,
    currentStatus: AppointmentStatus,
    nextStatus: AppointmentStatus,
  ): Promise<boolean> {
    const result = await this.dataSource
      .getRepository(AppointmentEntity)
      .update({ id, status: currentStatus }, { status: nextStatus });
    return result.affected === 1;
  }

  private async findConflictCandidates(
    appointments: Repository<AppointmentEntity>,
    field: 'doctorId' | 'patientId',
    ownerId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<AppointmentPeriod[]> {
    // Keep SQL preselection bounded; the business layer decides overlap.
    const candidates = await appointments
      .createQueryBuilder('appointment')
      .select(['appointment.startsAt', 'appointment.endsAt'])
      .where(`appointment.${field} = :ownerId`, { ownerId })
      .andWhere('appointment.status <> :cancelled', { cancelled: AppointmentStatus.CANCELLED })
      .andWhere('appointment.startsAt < :endsAt', { endsAt })
      .andWhere('appointment.endsAt > :startsAt', { startsAt })
      .getMany();
    return candidates.map(({ startsAt, endsAt }) => ({ startsAt, endsAt }));
  }

  private async create(manager: EntityManager, input: NewAppointment): Promise<Appointment> {
    const repository = manager.getRepository(AppointmentEntity);
    const saved = await repository.save(
      repository.create({
        id: randomUUID(),
        doctorId: input.doctorId,
        patientId: input.patientId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: AppointmentStatus.SCHEDULED,
      }),
    );
    return this.toAppointment(saved);
  }

  private toAppointment(appointment: AppointmentEntity): Appointment {
    return {
      id: appointment.id,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
      createdAt: appointment.createdAt,
    };
  }
}
