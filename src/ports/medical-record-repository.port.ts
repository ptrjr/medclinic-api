import type {
  MedicalRecord,
  MedicalRecordListQuery,
  MedicalRecordPage,
  NewMedicalRecord,
} from '../domain/medical-record';

export interface MedicalRecordRepositoryPort {
  hasCareRelationship(doctorId: string, patientId: string): Promise<boolean>;
  create(input: NewMedicalRecord): Promise<MedicalRecord>;
  list(patientId: string, query: MedicalRecordListQuery): Promise<MedicalRecordPage>;
}
