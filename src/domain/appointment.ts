export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

export interface CalendarAppointment {
  id: string;
  patientId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
}

export interface Appointment {
  id: string;
  doctorId: string;
  patientId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  createdAt: Date;
}

export type AppointmentPeriod = Pick<Appointment, 'startsAt' | 'endsAt'>;

export interface AppointmentListQuery {
  doctorId?: string;
  patientId?: string;
  status?: AppointmentStatus;
  fromInclusive?: Date;
  toExclusive?: Date;
  page: number;
  pageSize: number;
}

export interface AppointmentPage {
  items: Appointment[];
  total: number;
}

export interface NewAppointment {
  doctorId: string;
  patientId: string;
  startsAt: Date;
  endsAt: Date;
}
