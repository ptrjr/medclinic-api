import { AppointmentStatus, type AppointmentPeriod } from '../domain/appointment';
import { UserRole, type AuthPrincipal } from '../domain/user';
import type { WorkShift } from '../domain/work-schedule';
import { AppError } from '../errors/app-error';

const clinicTimeZone = 'America/Sao_Paulo';
const localDateTime = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
  timeZone: clinicTimeZone,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function periodsOverlap(a: AppointmentPeriod, b: AppointmentPeriod): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

function localParts(instant: Date) {
  const parts = localDateTime.formatToParts(instant);
  const value = (name: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === name)!.value;
  return {
    weekDay: weekdays[value('weekday')],
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
    hour: Number(value('hour')),
    minute: Number(value('minute')),
    second: Number(value('second')),
  };
}

function shiftMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function calculateAppointmentEnd(startsAt: Date, shifts: WorkShift[]): Date {
  const local = localParts(startsAt);
  const startMinute = local.hour * 60 + local.minute;
  const shift = shifts.find((item) => {
    const start = shiftMinutes(item.startTime);
    const end = shiftMinutes(item.endTime);
    return item.weekDay === local.weekDay && startMinute >= start && startMinute < end;
  });
  if (!shift || local.second !== 0 || startsAt.getUTCMilliseconds() !== 0) {
    throw new AppError('HORARIO_FORA_DA_ESCALA', 'Horário fora da escala do médico.');
  }

  const elapsedInShift = startMinute - shiftMinutes(shift.startTime);
  if (elapsedInShift % shift.slotDurationMinutes !== 0) {
    throw new AppError('HORARIO_FORA_DA_ESCALA', 'Horário não alinhado à grade do turno.');
  }
  if (startMinute + shift.slotDurationMinutes > shiftMinutes(shift.endTime)) {
    throw new AppError('HORARIO_FORA_DA_ESCALA', 'A consulta não cabe inteira no turno.');
  }

  return new Date(startsAt.getTime() + shift.slotDurationMinutes * 60_000);
}

type Transition = { from: AppointmentStatus; to: AppointmentStatus };

const transitions: Transition[] = [
  { from: AppointmentStatus.SCHEDULED, to: AppointmentStatus.IN_PROGRESS },
  { from: AppointmentStatus.SCHEDULED, to: AppointmentStatus.CANCELLED },
  { from: AppointmentStatus.IN_PROGRESS, to: AppointmentStatus.DONE },
  { from: AppointmentStatus.IN_PROGRESS, to: AppointmentStatus.CANCELLED },
];

export function assertCanTransition(
  current: AppointmentStatus,
  next: AppointmentStatus,
  actor: AuthPrincipal,
  ownsAppointment: boolean,
): void {
  const transition = transitions.find((item) => item.from === current && item.to === next);
  if (!transition) {
    throw new AppError('TRANSICAO_INVALIDA', 'Transição de status não permitida.');
  }
  const isAdmin = actor.roles.includes(UserRole.ADMIN);
  const isSecretary = actor.roles.includes(UserRole.SECRETARY);
  const isDoctor = actor.roles.includes(UserRole.DOCTOR) && ownsAppointment;
  const allowed =
    isAdmin ||
    (next === AppointmentStatus.CANCELLED &&
      current === AppointmentStatus.SCHEDULED &&
      isSecretary) ||
    isDoctor;
  if (!allowed) throw new AppError('ACESSO_NEGADO', 'Perfil sem permissão para a transição.');
}
