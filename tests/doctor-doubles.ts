import { vi } from 'vitest';
import type { Doctor } from '../src/domain/doctor';
import { UserRole } from '../src/domain/user';
import type { DoctorRepositoryPort } from '../src/ports/doctor-repository.port';
import { account, createDoubles } from './doubles';

export const doctor: Doctor = {
  id: '338e7dbe-0f78-4d60-9de4-ab92a20de060',
  crm: 'CRM-SC-54321',
  user: {
    ...account,
    name: 'Dra. Helena Souza',
    email: 'helena@example.com',
    roles: [UserRole.DOCTOR],
  },
};

export const doctorInput = {
  name: doctor.user.name,
  email: doctor.user.email,
  password: 'SenhaForte@123',
  crm: doctor.crm,
};

export function createDoctorDoubles() {
  const doctors = {
    findById: vi.fn<DoctorRepositoryPort['findById']>().mockResolvedValue(doctor),
    findByUserId: vi.fn<DoctorRepositoryPort['findByUserId']>().mockResolvedValue(doctor),
    findByCrm: vi.fn<DoctorRepositoryPort['findByCrm']>().mockResolvedValue(null),
    list: vi.fn<DoctorRepositoryPort['list']>().mockResolvedValue({ items: [doctor], total: 1 }),
    createWithUser: vi.fn<DoctorRepositoryPort['createWithUser']>().mockResolvedValue(doctor),
  };
  return { ...createDoubles(), doctors };
}
