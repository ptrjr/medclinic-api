import type { WorkShift } from '../domain/work-schedule';
import { AppError } from '../errors/app-error';

function clockMinutes(value: string): number {
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
    throw new AppError('DADOS_INVALIDOS', 'Hora deve usar HH:MM de 24 horas.');
  }
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function assertValidWorkShifts(shifts: WorkShift[]): void {
  for (const shift of shifts) {
    if (!Number.isInteger(shift.weekDay) || shift.weekDay < 0 || shift.weekDay > 6) {
      throw new AppError('DADOS_INVALIDOS', 'Dia da semana deve estar entre 0 e 6.');
    }
    if (!Number.isSafeInteger(shift.slotDurationMinutes) || shift.slotDurationMinutes <= 0) {
      throw new AppError('DADOS_INVALIDOS', 'A duração da consulta deve ser um inteiro positivo.');
    }
    if (clockMinutes(shift.startTime) >= clockMinutes(shift.endTime)) {
      throw new AppError('DADOS_INVALIDOS', 'O início do turno deve ser anterior ao fim.');
    }
  }
  // Ordena uma cópia apenas para validar; mantém a ordem enviada na resposta e no banco.
  const sorted = [...shifts].sort(
    (a, b) => a.weekDay - b.weekDay || a.startTime.localeCompare(b.startTime),
  );
  for (let index = 1; index < sorted.length; index++) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (previous.weekDay === current.weekDay && previous.endTime > current.startTime) {
      throw new AppError('DADOS_INVALIDOS', 'Turnos do mesmo dia não podem se sobrepor.');
    }
  }
}
