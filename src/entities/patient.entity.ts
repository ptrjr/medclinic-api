import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('patients')
export class PatientEntity {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  public id!: string;

  @Column({ type: 'varchar', length: 150 })
  public name!: string;

  @Column({ type: 'varchar', length: 11, unique: true })
  public cpf!: string;

  @Column({ name: 'birth_date', type: 'date' })
  public birthDate!: Date;

  @Column({ type: 'varchar', length: 30 })
  public phone!: string;

  @Column({ type: 'varchar', length: 254, nullable: true })
  public email!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updatedAt!: Date;
}
