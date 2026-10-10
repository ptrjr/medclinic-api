import { randomUUID } from 'node:crypto';
import { ILike, QueryFailedError, type Repository } from 'typeorm';
import type { NewPatient, Patient, PatientChanges, PatientPage } from '../domain/patient';
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
    const patient = await this.patients.findOneBy({ cpf });
    return patient ? this.toPatient(patient) : null;
  }

  public async list(page: number, limit: number, search?: string): Promise<PatientPage> {
    const where = search
      ? [{ name: ILike(`%${search}%`) }, { cpf: ILike(`%${search}%`) }]
      : undefined;
    const [items, total] = await this.patients.findAndCount({
      where,
      order: { name: 'ASC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items: items.map((patient) => this.toPatient(patient)), total };
  }

  public async create(input: NewPatient): Promise<Patient> {
    try {
      return this.toPatient(
        await this.patients.save(this.patients.create({ id: randomUUID(), ...input })),
      );
    } catch (error) {
      this.translateUniqueCpf(error);
      throw error;
    }
  }

  public async update(id: string, changes: PatientChanges): Promise<Patient | null> {
    try {
      const patient = await this.patients.preload({ id, ...changes });
      return patient ? this.toPatient(await this.patients.save(patient)) : null;
    } catch (error) {
      this.translateUniqueCpf(error);
      throw error;
    }
  }

  public async delete(id: string): Promise<boolean> {
    return (await this.patients.delete({ id })).affected === 1;
  }

  private translateUniqueCpf(error: unknown): void {
    if (error instanceof QueryFailedError) {
      const driverError: unknown = error.driverError;
      if (
        typeof driverError === 'object' &&
        driverError !== null &&
        'code' in driverError &&
        driverError.code === '23505'
      ) {
        throw new AppError('CPF_JA_CADASTRADO', 'CPF já cadastrado.');
      }
    }
  }

  private toPatient(patient: PatientEntity): Patient {
    return { ...patient };
  }
}
