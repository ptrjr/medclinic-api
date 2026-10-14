import { randomUUID } from 'node:crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import type { Doctor, DoctorListQuery, DoctorPage, NewDoctor } from '../domain/doctor';
import { UserRole } from '../domain/user';
import { DoctorEntity } from '../entities/doctor.entity';
import { UserEntity } from '../entities/user.entity';
import { AppError } from '../errors/app-error';
import type { DoctorRepositoryPort } from '../ports/doctor-repository.port';

export class TypeOrmDoctorRepository implements DoctorRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  public async findById(id: string): Promise<Doctor | null> {
    const doctor = await this.dataSource
      .getRepository(DoctorEntity)
      .findOne({ where: { id }, relations: { user: true } });
    return doctor ? this.toDoctor(doctor) : null;
  }

  public async findByCrm(crm: string): Promise<Doctor | null> {
    const doctor = await this.dataSource
      .getRepository(DoctorEntity)
      .findOne({ where: { crm }, relations: { user: true } });
    return doctor ? this.toDoctor(doctor) : null;
  }

  public async list(query: DoctorListQuery): Promise<DoctorPage> {
    const builder = this.dataSource
      .getRepository(DoctorEntity)
      .createQueryBuilder('doctor')
      .innerJoinAndSelect('doctor.user', 'user');
    if (query.name) {
      // Busca parcial literal: % e _ enviados pelo cliente não viram curingas SQL.
      const name = query.name.replace(/[\\%_]/g, '\\$&');
      builder.where('user.name ILIKE :name', { name: `%${name}%` });
    }
    const [items, total] = await builder
      .orderBy('user.name', 'ASC')
      .addOrderBy('doctor.id', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return { items: items.map((doctor) => this.toDoctor(doctor)), total };
  }

  public async createWithUser(input: NewDoctor): Promise<Doctor> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        // Ambos os repositories pertencem ao manager da transação.
        const users = manager.getRepository(UserEntity);
        const doctors = manager.getRepository(DoctorEntity);
        const user = await users.save(
          users.create({
            id: randomUUID(),
            name: input.name,
            email: input.email,
            passwordHash: input.passwordHash,
            roles: [UserRole.DOCTOR],
          }),
        );
        const doctor = await doctors.save(
          doctors.create({ id: randomUUID(), crm: input.crm, userId: user.id }),
        );
        return this.toDoctor({ ...doctor, user });
      });
    } catch (error) {
      // A transação já foi revertida antes da tradução de conflitos concorrentes.
      if (error instanceof QueryFailedError) {
        const details: unknown = error.driverError;
        if (
          typeof details === 'object' &&
          details !== null &&
          'code' in details &&
          details.code === '23505' &&
          'constraint' in details
        ) {
          if (details.constraint === 'doctors_crm_unique')
            throw new AppError('CRM_JA_CADASTRADO', 'CRM já cadastrado.');
          const emailConstraints = this.dataSource
            .getMetadata(UserEntity)
            .uniques.filter(
              (unique) => unique.columns.length === 1 && unique.columns[0].propertyName === 'email',
            )
            .map((unique) => unique.name);
          if (
            details.constraint === 'users_email_key' ||
            emailConstraints.includes(String(details.constraint))
          )
            throw new AppError('EMAIL_JA_CADASTRADO', 'E-mail já cadastrado.');
        }
      }
      throw error;
    }
  }

  private toDoctor(doctor: DoctorEntity): Doctor {
    const user = doctor.user;
    return {
      id: doctor.id,
      crm: doctor.crm,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: [...user.roles],
        passwordHash: user.passwordHash,
        createdAt: user.createdAt,
      },
    };
  }
}
