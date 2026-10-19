import { vi } from 'vitest';
import { AppointmentStatus } from '../src/domain/appointment';
import type { WorkShift } from '../src/domain/work-schedule';
import type { WorkScheduleRepositoryPort } from '../src/ports/work-schedule-repository.port';
import type { CalendarAppointmentsPort } from '../src/ports/calendar-appointments.port';
import { createDoctorDoubles } from './doctor-doubles';

export const shift: WorkShift = {
  weekDay: 2,
  startTime: '08:00',
  endTime: '12:00',
  slotDurationMinutes: 30,
};
export const consultation = {
  id: '90d5c7a4-071f-4b36-bf9c-9650447e178d',
  patientId: '20ba7288-1e53-4d79-8a38-4446c4840c28',
  startsAt: new Date('2026-10-13T11:00:00Z'),
  endsAt: new Date('2026-10-13T11:30:00Z'),
  status: AppointmentStatus.SCHEDULED,
};

export function createPlanningDoubles() {
  return {
    ...createDoctorDoubles(),
    schedules: {
      getShifts: vi.fn<WorkScheduleRepositoryPort['getShifts']>().mockResolvedValue([shift]),
      replaceShifts: vi
        .fn<WorkScheduleRepositoryPort['replaceShifts']>()
        .mockResolvedValue(undefined),
    },
    appointments: {
      listActiveForDoctor: vi
        .fn<CalendarAppointmentsPort['listActiveForDoctor']>()
        .mockResolvedValue([consultation]),
    },
  };
}
