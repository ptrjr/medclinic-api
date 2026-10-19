import { randomUUID } from 'node:crypto';
import { IsNull, QueryFailedError, type Repository } from 'typeorm';
import type {
  NewPatient,
  Patient,
  PatientChanges,
  PatientListQuery,
  PatientPage,
} from '../domain/patient';
import { PatientEntity } from '../entities/patient.entity';
import { AppError } from '../errors/app-error';
import type { PatientRepositoryPort } from '../ports/patient-repository.port';

export class TypeOrmPatientRepository implements PatientRepositoryPort {
  constructor(private readonly patients: Repository<PatientEntity>) {}

  public async findById(id: string): Promise<Patient | null> {
    const patient = await this.patients.findOneBy({ id });
    return patient ? this.toPatient(patient) : null;
  }

  public async findByCpf(cpf: string): Promise<Patient | null> {
    // O CPF continua reservado após exclusão lógica: a identidade não é recriada.
    const patient = await this.patients.findOne({ where: { cpf }, withDeleted: true });
    return patient ? this.toPatient(patient) : null;
  }

  public async list(query: PatientListQuery): Promise<PatientPage> {
    const builder = this.patients.createQueryBuilder('patient');
    if (query.name) {
      const name = query.name.replace(/[\\%_]/g, '\\$&');
      builder.where('patient.name ILIKE :name', { name: `%${name}%` });
    }
    const [items, total] = await builder
      .orderBy('patient.name', 'ASC')
      .addOrderBy('patient.id', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return { items: items.map((patient) => this.toPatient(patient)), total };
  }

  public async create(input: NewPatient): Promise<Patient> {
    try {
      return this.toPatient(
        await this.patients.save(
          this.patients.create({ id: randomUUID(), name: input.name, cpf: input.cpf }),
        ),
      );
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const details: unknown = error.driverError;
        if (
          typeof details === 'object' &&
          details !== null &&
          'code' in details &&
          details.code === '23505' &&
          'constraint' in details &&
          details.constraint === 'patients_cpf_key'
        ) {
          throw new AppError('CPF_JA_CADASTRADO', 'CPF já cadastrado.');
        }
      }
      throw error;
    }
  }

  public async update(id: string, changes: PatientChanges): Promise<Patient | null> {
    // Uma remoção entre o pré-check do service e o UPDATE não pode reativar a linha.
    const result = await this.patients.update({ id, deletedAt: IsNull() }, changes);
    return result.affected === 1 ? this.findById(id) : null;
  }

  public async delete(id: string): Promise<boolean> {
    return (await this.patients.softDelete({ id, deletedAt: IsNull() })).affected === 1;
  }

  private toPatient(patient: PatientEntity): Patient {
    return { id: patient.id, name: patient.name, cpf: patient.cpf, createdAt: patient.createdAt };
  }
}
