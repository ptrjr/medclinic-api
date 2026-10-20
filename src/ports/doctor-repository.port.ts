import type { Doctor, DoctorListQuery, DoctorPage, NewDoctor } from '../domain/doctor';

export interface DoctorRepositoryPort {
  findById(id: string): Promise<Doctor | null>;
  findByUserId(userId: string): Promise<Doctor | null>;
  findByCrm(crm: string): Promise<Doctor | null>;
  list(query: DoctorListQuery): Promise<DoctorPage>;
  createWithUser(input: NewDoctor): Promise<Doctor>;
}
