import type { DoctorListQuery } from '../domain/doctor';
import { UserRole, type AuthPrincipal } from '../domain/user';
import {
  toDoctorResponse,
  type CreateDoctorInput,
  type DoctorListResponse,
  type DoctorResponse,
} from '../dtos/doctor.dto';
import { AppError } from '../errors/app-error';
import type { DoctorRepositoryPort } from '../ports/doctor-repository.port';
import type { PasswordHasherPort } from '../ports/password-hasher.port';
import type { UserRepositoryPort } from '../ports/user-repository.port';

export class DoctorService {
  constructor(
    private readonly doctors: DoctorRepositoryPort,
    private readonly users: UserRepositoryPort,
    private readonly passwords: PasswordHasherPort,
  ) {}

  public async create(input: CreateDoctorInput, actor: AuthPrincipal): Promise<DoctorResponse> {
    if (!actor.roles.includes(UserRole.ADMIN)) {
      throw new AppError('ACESSO_NEGADO', 'Apenas administradores podem cadastrar médicos.');
    }
    if (await this.users.findByEmail(input.email)) {
      throw new AppError('EMAIL_JA_CADASTRADO', 'E-mail já cadastrado.');
    }
    if (await this.doctors.findByCrm(input.crm)) {
      throw new AppError('CRM_JA_CADASTRADO', 'CRM já cadastrado.');
    }
    const doctor = await this.doctors.createWithUser({
      name: input.name,
      email: input.email,
      crm: input.crm,
      passwordHash: await this.passwords.hash(input.password),
    });
    return toDoctorResponse(doctor);
  }

  public async getById(id: string): Promise<DoctorResponse> {
    const doctor = await this.doctors.findById(id);
    if (!doctor) throw new AppError('RECURSO_NAO_ENCONTRADO', 'Médico não encontrado.');
    return toDoctorResponse(doctor);
  }

  public async list(query: DoctorListQuery): Promise<DoctorListResponse> {
    const result = await this.doctors.list(query);
    return {
      data: result.items.map(toDoctorResponse),
      meta: {
        total: result.total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }
}
