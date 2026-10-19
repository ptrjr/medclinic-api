import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { WorkShift } from '../domain/work-schedule';
import { DoctorEntity } from './doctor.entity';

@Entity('doctor_work_schedules')
export class WorkScheduleEntity {
  @PrimaryColumn({ name: 'doctor_id', type: 'uuid' })
  public doctorId!: string;

  @OneToOne(() => DoctorEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'doctor_id' })
  public doctor!: DoctorEntity;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  public shifts!: WorkShift[];

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  public updatedAt!: Date;
}
