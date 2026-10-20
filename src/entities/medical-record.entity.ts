import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { DoctorEntity } from './doctor.entity';
import { PatientEntity } from './patient.entity';

@Entity('medical_records')
export class MedicalRecordEntity {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  public id!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  public patientId!: string;

  @ManyToOne(() => PatientEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id' })
  public patient!: PatientEntity;

  @Column({ name: 'doctor_id', type: 'uuid' })
  public doctorId!: string;

  @ManyToOne(() => DoctorEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'doctor_id' })
  public doctor!: DoctorEntity;

  @Column({ type: 'text' })
  public text!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public createdAt!: Date;
}
