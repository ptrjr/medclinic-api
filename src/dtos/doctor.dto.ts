import { z } from 'zod';
import type { Doctor } from '../domain/doctor';
import { emailSchema, passwordSchema, toUserResponse, type UserResponse } from './auth.dto';

export const createDoctorSchema = z.strictObject({
  name: z.string().trim().min(1).max(150),
  email: emailSchema,
  password: passwordSchema,
  crm: z.string().trim().min(1).max(50),
});

// Query HTTP chega como string; rejeita valores vazios, frações e arrays.
function paginationNumber(maximum: number) {
  return z
    .string()
    .regex(/^[0-9]+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(maximum));
}

export const listDoctorsQuerySchema = z.object({
  page: paginationNumber(Number.MAX_SAFE_INTEGER).default(1),
  pageSize: paginationNumber(100).default(20),
  name: z.string().trim().min(1).max(150).optional(),
});

export const doctorIdSchema = z.uuid();
export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;

export interface DoctorResponse {
  id: string;
  crm: string;
  user: UserResponse;
}

export interface DoctorListResponse {
  data: DoctorResponse[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

export function toDoctorResponse(doctor: Doctor): DoctorResponse {
  return { id: doctor.id, crm: doctor.crm, user: toUserResponse(doctor.user) };
}
