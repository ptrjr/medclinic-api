import {
  toPatientResponse,
  type CreatePatientInput,
  type ListPatientsQuery,
  type PatientResponse,
  type PatientListResponse,
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
    return toPatientResponse(await this.patients.create({ name: input.name, cpf: input.cpf }));
  }

  public async getById(id: string): Promise<PatientResponse> {
    return toPatientResponse(await this.requirePatient(id));
  }

  public async list(query: ListPatientsQuery): Promise<PatientListResponse> {
    const result = await this.patients.list(query);
    return {
      data: result.items.map(toPatientResponse),
      meta: {
        total: result.total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }

  public async update(id: string, input: UpdatePatientInput): Promise<PatientResponse> {
    await this.requirePatient(id);
    const patient = await this.patients.update(id, { name: input.name });
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
