import { z } from 'zod';
import type { Patient } from '../domain/patient';

const nameSchema = z.string().trim().min(1).max(150);
// O contrato pede formato de 11 dígitos; o exemplo 12345678901 deve ser aceito.
const cpfSchema = z
  .string()
  .regex(/^[0-9]{11}$/, 'CPF deve conter exatamente 11 dígitos sem pontuação.');

export const createPatientSchema = z.strictObject({ name: nameSchema, cpf: cpfSchema });
export const updatePatientSchema = z.strictObject({ name: nameSchema });

function paginationNumber(maximum: number) {
  return z
    .string()
    .regex(/^[0-9]+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(maximum));
}

export const patientIdSchema = z.uuid();
export const listPatientsQuerySchema = z.object({
  page: paginationNumber(Number.MAX_SAFE_INTEGER).default(1),
  pageSize: paginationNumber(100).default(20),
  name: nameSchema.optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;

export interface PatientResponse {
  id: string;
  name: string;
  cpf: string;
  createdAt: string;
}

export interface PatientListResponse {
  data: PatientResponse[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

export function toPatientResponse(patient: Patient): PatientResponse {
  return {
    id: patient.id,
    name: patient.name,
    cpf: patient.cpf,
    createdAt: patient.createdAt.toISOString(),
  };
}
