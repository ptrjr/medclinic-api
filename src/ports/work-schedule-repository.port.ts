import type { WorkShift } from '../domain/work-schedule';

export interface WorkScheduleRepositoryPort {
  getShifts(doctorId: string): Promise<WorkShift[]>;
  replaceShifts(doctorId: string, shifts: WorkShift[]): Promise<void>;
}
