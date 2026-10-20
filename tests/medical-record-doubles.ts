import { vi } from 'vitest';
import type { MedicalRecord } from '../src/domain/medical-record';
import type { MedicalRecordRepositoryPort } from '../src/ports/medical-record-repository.port';
import { createDoctorDoubles, doctor } from './doctor-doubles';
import { createPatientDoubles, patient } from './patient-doubles';

export const medicalRecord: MedicalRecord = {
  id: '84e621fe-9493-4bc9-86ce-2a4a6a62f8a4',
  patientId: patient.id,
  doctorId: doctor.id,
  text: 'Paciente relata dor lombar há duas semanas. Solicitado raio-X.',
  createdAt: new Date('2026-10-19T15:25:00.000Z'),
};

export function createMedicalRecordDoubles() {
  return {
    doctors: createDoctorDoubles().doctors,
    patients: createPatientDoubles(),
    records: {
      hasCareRelationship: vi
        .fn<MedicalRecordRepositoryPort['hasCareRelationship']>()
        .mockResolvedValue(true),
      create: vi.fn<MedicalRecordRepositoryPort['create']>().mockResolvedValue(medicalRecord),
      list: vi
        .fn<MedicalRecordRepositoryPort['list']>()
        .mockResolvedValue({ items: [medicalRecord], total: 1 }),
    },
  };
}
