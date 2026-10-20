export interface MedicalRecord {
  id: string;
  patientId: string;
  doctorId: string;
  text: string;
  createdAt: Date;
}

export interface NewMedicalRecord {
  patientId: string;
  doctorId: string;
  text: string;
}

export interface MedicalRecordListQuery {
  page: number;
  pageSize: number;
}

export interface MedicalRecordPage {
  items: MedicalRecord[];
  total: number;
}
