import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('doctors')
export class DoctorEntity {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  public id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  public crm!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  public userId!: string;

  @OneToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  public user!: UserEntity;
}
