import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { AppointmentStatus } from '../domain/appointment';
import { DoctorEntity } from './doctor.entity';
import { PatientEntity } from './patient.entity';

@Entity('appointments')
export class AppointmentEntity {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  public id!: string;

  @Column({ name: 'doctor_id', type: 'uuid' })
  public doctorId!: string;

  @ManyToOne(() => DoctorEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'doctor_id' })
  public doctor!: DoctorEntity;

  @Column({ name: 'patient_id', type: 'uuid' })
  public patientId!: string;

  @ManyToOne(() => PatientEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id' })
  public patient!: PatientEntity;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  public startsAt!: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  public endsAt!: Date;

  @Column({ type: 'varchar', length: 20, default: AppointmentStatus.SCHEDULED })
  public status!: AppointmentStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public createdAt!: Date;
}
