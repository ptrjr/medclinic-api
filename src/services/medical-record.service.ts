import type { MedicalRecordListQuery } from '../domain/medical-record';
import { UserRole, type AuthPrincipal } from '../domain/user';
import {
  toMedicalRecordResponse,
  type CreateMedicalRecordInput,
  type MedicalRecordListResponse,
  type MedicalRecordResponse,
} from '../dtos/medical-record.dto';
import { AppError } from '../errors/app-error';
import type { DoctorRepositoryPort } from '../ports/doctor-repository.port';
import type { MedicalRecordRepositoryPort } from '../ports/medical-record-repository.port';
import type { PatientRepositoryPort } from '../ports/patient-repository.port';

export class MedicalRecordService {
  constructor(
    private readonly records: MedicalRecordRepositoryPort,
    private readonly patients: PatientRepositoryPort,
    private readonly doctors: DoctorRepositoryPort,
  ) {}

  public async create(
    patientId: string,
    input: CreateMedicalRecordInput,
    actor: AuthPrincipal,
  ): Promise<MedicalRecordResponse> {
    if (!actor.roles.includes(UserRole.DOCTOR)) {
      throw new AppError(
        'ACESSO_NEGADO',
        'Somente médico com vínculo pode escrever no prontuário.',
      );
    }
    await this.requirePatient(patientId);
    const doctorId = await this.requireCareRelationship(patientId, actor.id);
    return toMedicalRecordResponse(
      await this.records.create({ patientId, doctorId, text: input.text }),
    );
  }

  public async list(
    patientId: string,
    query: MedicalRecordListQuery,
    actor: AuthPrincipal,
  ): Promise<MedicalRecordListResponse> {
    const isAdmin = actor.roles.includes(UserRole.ADMIN);
    if (!isAdmin && !actor.roles.includes(UserRole.DOCTOR)) {
      throw new AppError('ACESSO_NEGADO', 'Perfil sem permissão para consultar o prontuário.');
    }
    await this.requirePatient(patientId);
    if (!isAdmin) await this.requireCareRelationship(patientId, actor.id);
    const page = await this.records.list(patientId, query);
    return {
      data: page.items.map(toMedicalRecordResponse),
      meta: {
        total: page.total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(page.total / query.pageSize),
      },
    };
  }

  private async requirePatient(patientId: string): Promise<void> {
    if (!(await this.patients.findById(patientId))) {
      throw new AppError('RECURSO_NAO_ENCONTRADO', 'Paciente não encontrado.');
    }
  }

  private async requireCareRelationship(patientId: string, userId: string): Promise<string> {
    const doctor = await this.doctors.findByUserId(userId);
    if (!doctor || !(await this.records.hasCareRelationship(doctor.id, patientId))) {
      throw new AppError(
        'ACESSO_NEGADO',
        'Médico sem atendimento em andamento ou concluído para este paciente.',
      );
    }
    return doctor.id;
  }
}
