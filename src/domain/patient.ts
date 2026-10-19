export interface Patient {
  id: string;
  name: string;
  cpf: string;
  createdAt: Date;
}

export interface NewPatient {
  name: string;
  cpf: string;
}

export interface PatientChanges {
  name: string;
}

export interface PatientListQuery {
  page: number;
  pageSize: number;
  name?: string;
}

export interface PatientPage {
  items: Patient[];
  total: number;
}
