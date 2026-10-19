import { z } from 'zod';
import type { AppointmentStatus } from '../domain/appointment';
import type { WorkSchedule } from '../domain/work-schedule';

export const calendarQuerySchema = z.object({ from: z.iso.date(), to: z.iso.date() });
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;

export interface CalendarResponse {
  workSchedule: WorkSchedule;
  appointments: {
    id: string;
    patientId: string;
    startsAt: string;
    endsAt: string;
    status: AppointmentStatus;
  }[];
}
