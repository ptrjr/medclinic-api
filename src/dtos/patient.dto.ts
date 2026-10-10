import { z } from 'zod';
import type { Patient } from '../domain/patient';
import { emailSchema } from './auth.dto';

function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (factor: number): number => {
    const sum = cpf
      .slice(0, factor - 1)
      .split('')
      .reduce((total, value, index) => total + Number(value) * (factor - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(10) === Number(cpf[9]) && digit(11) === Number(cpf[10]);
}

const cpfSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ''))
  .refine(isValidCpf, 'CPF inválido.');

const birthDateSchema = z.coerce.date().refine((value) => value <= new Date(), {
  message: 'A data de nascimento não pode estar no futuro.',
});

const patientFields = {
  name: z.string().trim().min(1).max(150),
  cpf: cpfSchema,
  birthDate: birthDateSchema,
  phone: z.string().trim().min(8).max(30),
  email: emailSchema.nullable().optional(),
};

export const createPatientSchema = z.strictObject(patientFields);
export const updatePatientSchema = z
  .strictObject({
    name: patientFields.name.optional(),
    cpf: patientFields.cpf.optional(),
    birthDate: patientFields.birthDate.optional(),
    phone: patientFields.phone.optional(),
    email: patientFields.email,
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Informe ao menos um campo para atualização.',
  });

export const patientIdSchema = z.uuid();
export const listPatientsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(150).optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;

export interface PatientResponse {
  id: string;
  name: string;
  cpf: string;
  birthDate: string;
  phone: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toPatientResponse(patient: Patient): PatientResponse {
  return {
    id: patient.id,
    name: patient.name,
    cpf: patient.cpf,
    birthDate: patient.birthDate.toISOString().slice(0, 10),
    phone: patient.phone,
    email: patient.email,
    createdAt: patient.createdAt.toISOString(),
    updatedAt: patient.updatedAt.toISOString(),
  };
}
