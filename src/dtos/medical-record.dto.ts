import { z } from 'zod';
import type { MedicalRecord } from '../domain/medical-record';

// z.object remove campos desconhecidos. O contrato exige ignorar doctorId enviado no corpo.
export const createMedicalRecordSchema = z.object({ text: z.string().trim().min(1) });

function paginationNumber(maximum: number) {
  return z
    .string()
    .regex(/^[0-9]+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(maximum));
}

export const listMedicalRecordsQuerySchema = z.object({
  page: paginationNumber(Number.MAX_SAFE_INTEGER).default(1),
  pageSize: paginationNumber(100).default(20),
});

export type CreateMedicalRecordInput = z.infer<typeof createMedicalRecordSchema>;

export interface MedicalRecordResponse {
  id: string;
  patientId: string;
  doctorId: string;
  text: string;
  createdAt: string;
}

export interface MedicalRecordListResponse {
  data: MedicalRecordResponse[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

export function toMedicalRecordResponse(record: MedicalRecord): MedicalRecordResponse {
  return {
    id: record.id,
    patientId: record.patientId,
    doctorId: record.doctorId,
    text: record.text,
    createdAt: record.createdAt.toISOString(),
  };
}
