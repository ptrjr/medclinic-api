import { vi } from 'vitest';
import type { Patient } from '../src/domain/patient';
import type { PatientRepositoryPort } from '../src/ports/patient-repository.port';

export const patient: Patient = {
  id: '20ba7288-1e53-4d79-8a38-4446c4840c28',
  name: 'Carlos Pereira',
  cpf: '12345678901',
  createdAt: new Date('2026-10-20T14:03:11.000Z'),
};
export const patientResponse = {
  id: patient.id,
  name: patient.name,
  cpf: patient.cpf,
  createdAt: '2026-10-20T14:03:11.000Z',
};

export function createPatientDoubles() {
  return {
    findById: vi.fn<PatientRepositoryPort['findById']>().mockResolvedValue(patient),
    findByCpf: vi.fn<PatientRepositoryPort['findByCpf']>().mockResolvedValue(null),
    list: vi.fn<PatientRepositoryPort['list']>().mockResolvedValue({ items: [patient], total: 1 }),
    create: vi.fn<PatientRepositoryPort['create']>().mockResolvedValue(patient),
    update: vi.fn<PatientRepositoryPort['update']>().mockResolvedValue(patient),
    delete: vi.fn<PatientRepositoryPort['delete']>().mockResolvedValue(true),
  };
}
