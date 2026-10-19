import { z } from 'zod';

export const workShiftSchema = z.strictObject({
  weekDay: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
  slotDurationMinutes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

export const replaceWorkScheduleSchema = z.strictObject({ shifts: z.array(workShiftSchema) });
export const planningDoctorIdSchema = z.uuid();
