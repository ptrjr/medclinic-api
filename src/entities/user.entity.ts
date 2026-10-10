import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';
import { UserRole } from '../domain/user';

@Entity('users')
export class UserEntity {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  public id!: string;

  @Column({ type: 'varchar' })
  public name!: string;

  @Column({ type: 'varchar', unique: true })
  public email!: string;

  @Column({ name: 'password', type: 'varchar' })
  public passwordHash!: string;

  @Column({ type: 'text', array: true, default: () => "ARRAY['secretary']::text[]" })
  public roles!: UserRole[];

  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt!: Date;
}
