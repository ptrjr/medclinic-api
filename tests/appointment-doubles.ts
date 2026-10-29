import { vi } from 'vitest';
import { AppointmentStatus, type Appointment } from '../src/domain/appointment';
import type { AppointmentRepositoryPort } from '../src/ports/appointment-repository.port';
import type { AppointmentBookingTransactionPort } from '../src/ports/appointment-repository.port';
import { shift } from './planning-doubles';

export const appointment: Appointment = {
  id: 'b8a7bb38-c016-4a68-8eaf-6a405c91c521',
  doctorId: '338e7dbe-0f78-4d60-9de4-ab92a20de060',
  patientId: '20ba7288-1e53-4d79-8a38-4446c4840c28',
  startsAt: new Date('2026-10-20T11:00:00.000Z'),
  endsAt: new Date('2026-10-20T11:30:00.000Z'),
  status: AppointmentStatus.SCHEDULED,
  createdAt: new Date('2026-10-19T12:00:00.000Z'),
};

export const createAppointmentInput = {
  doctorId: appointment.doctorId,
  patientId: appointment.patientId,
  startsAt: '2026-10-20T08:00:00-03:00',
};

export function createBookingTransaction() {
  const exists = { doctor: true, patient: true };
  const transaction = {
    get doctorExists() {
      return exists.doctor;
    },
    get patientExists() {
      return exists.patient;
    },
    getWorkShifts: vi
      .fn<AppointmentBookingTransactionPort['getWorkShifts']>()
      .mockResolvedValue([shift]),
    findDoctorConflictCandidates: vi
      .fn<AppointmentBookingTransactionPort['findDoctorConflictCandidates']>()
      .mockResolvedValue([]),
    findPatientConflictCandidates: vi
      .fn<AppointmentBookingTransactionPort['findPatientConflictCandidates']>()
      .mockResolvedValue([]),
    create: vi.fn<AppointmentBookingTransactionPort['create']>().mockResolvedValue(appointment),
  } satisfies AppointmentBookingTransactionPort;
  return { transaction, exists };
}

export function createAppointmentDoubles() {
  const booking = createBookingTransaction();
  const transaction = booking.transaction;
  const bookingCalls: { doctorId: string; patientId: string }[] = [];
  const state: { failure: unknown } = { failure: null };
  const appointments = {
    async withBookingLocks(doctorId, patientId, operation) {
      bookingCalls.push({ doctorId, patientId });
      if (state.failure) throw state.failure;
      return operation(transaction);
    },
    findById: vi.fn<AppointmentRepositoryPort['findById']>().mockResolvedValue(appointment),
    list: vi
      .fn<AppointmentRepositoryPort['list']>()
      .mockResolvedValue({ items: [appointment], total: 1 }),
    updateStatusIfCurrent: vi
      .fn<AppointmentRepositoryPort['updateStatusIfCurrent']>()
      .mockResolvedValue(true),
  } satisfies AppointmentRepositoryPort;
  return { appointments, transaction, exists: booking.exists, bookingCalls, state };
}
