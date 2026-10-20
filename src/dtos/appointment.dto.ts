import { z } from 'zod';
import { AppointmentStatus, type Appointment } from '../domain/appointment';
import { localDayBounds } from '../rules/calendar-period.rules';

export const createAppointmentSchema = z.strictObject({
  doctorId: z.uuid(),
  patientId: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }),
});

export const appointmentIdSchema = z.uuid();
export const updateAppointmentStatusSchema = z.strictObject({
  status: z.enum(AppointmentStatus),
});

function paginationNumber(maximum: number) {
  return z
    .string()
    .regex(/^[0-9]+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(maximum));
}

export const listAppointmentsQuerySchema = z
  .object({
    doctorId: z.uuid().optional(),
    patientId: z.uuid().optional(),
    status: z.enum(AppointmentStatus).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    page: paginationNumber(Number.MAX_SAFE_INTEGER).default(1),
    pageSize: paginationNumber(100).default(20),
  })
  .superRefine((query, context) => {
    if (query.from && query.to && query.from > query.to) {
      context.addIssue({ code: 'custom', message: 'from não pode ser posterior a to.' });
    }
  })
  .transform((query) => {
    const fromInclusive = query.from ? localDayBounds(query.from).fromInclusive : undefined;
    const toExclusive = query.to ? localDayBounds(query.to).toExclusive : undefined;
    return { ...query, fromInclusive, toExclusive };
  });

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;

export interface AppointmentResponse {
  id: string;
  doctorId: string;
  patientId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
}

export interface AppointmentListResponse {
  data: AppointmentResponse[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

export function toAppointmentResponse(appointment: Appointment): AppointmentResponse {
  return {
    id: appointment.id,
    doctorId: appointment.doctorId,
    patientId: appointment.patientId,
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt.toISOString(),
    status: appointment.status,
  };
}
