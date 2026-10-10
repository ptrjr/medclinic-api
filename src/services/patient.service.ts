import type { PatientChanges } from '../domain/patient';
import {
  toPatientResponse,
  type CreatePatientInput,
  type ListPatientsQuery,
  type PatientResponse,
  type UpdatePatientInput,
} from '../dtos/patient.dto';
import { AppError } from '../errors/app-error';
import type { PatientRepositoryPort } from '../ports/patient-repository.port';

export class PatientService {
  constructor(private readonly patients: PatientRepositoryPort) {}

  public async create(input: CreatePatientInput): Promise<PatientResponse> {
    if (await this.patients.findByCpf(input.cpf)) {
      throw new AppError('CPF_JA_CADASTRADO', 'CPF já cadastrado.');
    }
    return toPatientResponse(await this.patients.create({ ...input, email: input.email ?? null }));
  }

  public async getById(id: string): Promise<PatientResponse> {
    return toPatientResponse(await this.requirePatient(id));
  }

  public async list(
    query: ListPatientsQuery,
  ): Promise<{ items: PatientResponse[]; total: number; page: number; pageSize: number }> {
    const result = await this.patients.list(query.page, query.pageSize, query.search);
    return {
      items: result.items.map(toPatientResponse),
      total: result.total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  public async update(id: string, input: UpdatePatientInput): Promise<PatientResponse> {
    await this.requirePatient(id);
    if (input.cpf) {
      const sameCpf = await this.patients.findByCpf(input.cpf);
      if (sameCpf && sameCpf.id !== id)
        throw new AppError('CPF_JA_CADASTRADO', 'CPF já cadastrado.');
    }
    const changes: PatientChanges = { ...input };
    if (changes.email === undefined) delete changes.email;
    const patient = await this.patients.update(id, changes);
    if (!patient) throw new AppError('RECURSO_NAO_ENCONTRADO', 'Paciente não encontrado.');
    return toPatientResponse(patient);
  }

  public async delete(id: string): Promise<void> {
    await this.requirePatient(id);
    if (!(await this.patients.delete(id)))
      throw new AppError('RECURSO_NAO_ENCONTRADO', 'Paciente não encontrado.');
  }

  private async requirePatient(id: string) {
    const patient = await this.patients.findById(id);
    if (!patient) throw new AppError('RECURSO_NAO_ENCONTRADO', 'Paciente não encontrado.');
    return patient;
  }
}
