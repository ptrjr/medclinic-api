import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { AppointmentStatus } from '../domain/appointment';
import type {
  MedicalRecord,
  MedicalRecordListQuery,
  MedicalRecordPage,
  NewMedicalRecord,
} from '../domain/medical-record';
import { AppointmentEntity } from '../entities/appointment.entity';
import { MedicalRecordEntity } from '../entities/medical-record.entity';
import type { MedicalRecordRepositoryPort } from '../ports/medical-record-repository.port';

export class TypeOrmMedicalRecordRepository implements MedicalRecordRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  public async hasCareRelationship(doctorId: string, patientId: string): Promise<boolean> {
    return this.dataSource
      .getRepository(AppointmentEntity)
      .createQueryBuilder('appointment')
      .where('appointment.doctorId = :doctorId', { doctorId })
      .andWhere('appointment.patientId = :patientId', { patientId })
      .andWhere('appointment.status IN (:...statuses)', {
        statuses: [AppointmentStatus.IN_PROGRESS, AppointmentStatus.DONE],
      })
      .getExists();
  }

  public async create(input: NewMedicalRecord): Promise<MedicalRecord> {
    const repository = this.dataSource.getRepository(MedicalRecordEntity);
    return this.toMedicalRecord(
      await repository.save(
        repository.create({
          id: randomUUID(),
          patientId: input.patientId,
          doctorId: input.doctorId,
          text: input.text,
        }),
      ),
    );
  }

  public async list(patientId: string, query: MedicalRecordListQuery): Promise<MedicalRecordPage> {
    const [items, total] = await this.dataSource
      .getRepository(MedicalRecordEntity)
      .createQueryBuilder('record')
      .where('record.patientId = :patientId', { patientId })
      .orderBy('record.createdAt', 'DESC')
      .addOrderBy('record.id', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return { items: items.map((record) => this.toMedicalRecord(record)), total };
  }

  private toMedicalRecord(record: MedicalRecordEntity): MedicalRecord {
    return {
      id: record.id,
      patientId: record.patientId,
      doctorId: record.doctorId,
      text: record.text,
      createdAt: record.createdAt,
    };
  }
}
