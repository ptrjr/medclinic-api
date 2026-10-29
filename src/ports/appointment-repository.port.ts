import type {
  Appointment,
  AppointmentListQuery,
  AppointmentPage,
  AppointmentPeriod,
  AppointmentStatus,
  NewAppointment,
} from '../domain/appointment';
import type { WorkShift } from '../domain/work-schedule';

export interface AppointmentBookingTransactionPort {
  doctorExists: boolean;
  patientExists: boolean;
  getWorkShifts(): Promise<WorkShift[]>;
  // Non-cancelled periods preselected by owner and requested time window.
  findDoctorConflictCandidates(startsAt: Date, endsAt: Date): Promise<AppointmentPeriod[]>;
  findPatientConflictCandidates(startsAt: Date, endsAt: Date): Promise<AppointmentPeriod[]>;
  create(input: NewAppointment): Promise<Appointment>;
}

export interface AppointmentRepositoryPort {
  withBookingLocks<T>(
    doctorId: string,
    patientId: string,
    operation: (transaction: AppointmentBookingTransactionPort) => Promise<T>,
  ): Promise<T>;
  findById(id: string): Promise<Appointment | null>;
  list(query: AppointmentListQuery): Promise<AppointmentPage>;
  updateStatusIfCurrent(
    id: string,
    currentStatus: AppointmentStatus,
    nextStatus: AppointmentStatus,
  ): Promise<boolean>;
}
