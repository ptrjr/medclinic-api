import type {
  NewPatient,
  Patient,
  PatientChanges,
  PatientListQuery,
  PatientPage,
} from '../domain/patient';

export interface PatientRepositoryPort {
  findById(id: string): Promise<Patient | null>;
  findByCpf(cpf: string): Promise<Patient | null>;
  list(query: PatientListQuery): Promise<PatientPage>;
  create(input: NewPatient): Promise<Patient>;
  update(id: string, changes: PatientChanges): Promise<Patient | null>;
  delete(id: string): Promise<boolean>;
}
