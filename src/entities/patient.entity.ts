import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('patients')
export class PatientEntity {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  public id!: string;

  @Column({ type: 'varchar', length: 150 })
  public name!: string;

  @Column({ type: 'varchar', length: 11, unique: true })
  public cpf!: string;

  // Campos da versão anterior são preservados no banco, mas não integram o contrato público.
  @Column({ name: 'birth_date', type: 'date', nullable: true })
  public birthDate!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  public phone!: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  public email!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  public deletedAt!: Date | null;
}
