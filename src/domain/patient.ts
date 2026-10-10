export interface Patient {
  id: string;
  name: string;
  cpf: string;
  birthDate: Date;
  phone: string;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPatient {
  name: string;
  cpf: string;
  birthDate: Date;
  phone: string;
  email: string | null;
}

export interface PatientChanges {
  name?: string;
  cpf?: string;
  birthDate?: Date;
  phone?: string;
  email?: string | null;
}

export interface PatientPage {
  items: Patient[];
  total: number;
}
