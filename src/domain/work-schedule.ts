export interface WorkShift {
  weekDay: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
}

export interface WorkSchedule {
  shifts: WorkShift[];
}
