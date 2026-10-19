import { AppError } from '../errors/app-error';

const DAY_MS = 86_400_000;
export const CLINIC_TIME_ZONE = 'America/Sao_Paulo';
const localDateFormatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
  timeZone: CLINIC_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  era: 'short',
});

function parseDate(value: string): Date {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
    throw new AppError('DADOS_INVALIDOS', 'Datas devem usar YYYY-MM-DD.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() < 1 ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new AppError('DADOS_INVALIDOS', 'Data inexistente.');
  }
  return date;
}

function dateKey(date: Date): number {
  return date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
}

function localDateKey(timestamp: number): number {
  const parts = localDateFormatter.formatToParts(new Date(timestamp));
  const value = (kind: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === kind)!.value;
  const year = value('era') === 'BC' ? 1 - Number(value('year')) : Number(value('year'));
  return year * 10000 + Number(value('month')) * 100 + Number(value('day'));
}

// Primeiro instante do dia local. Não fixa UTC-3: usa a base IANA do Intl,
// inclusive quando uma transição histórica de horário de verão pula a meia-noite.
function startOfLocalDay(date: Date): Date {
  const target = dateKey(date);
  let lower = date.getTime() - 36 * 3_600_000;
  let upper = date.getTime() + 36 * 3_600_000;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (localDateKey(middle) < target) lower = middle + 1;
    else upper = middle;
  }
  return new Date(lower);
}

export interface CalendarPeriod {
  fromInclusive: Date;
  toExclusive: Date;
}

export function calendarPeriod(from: string, to: string): CalendarPeriod {
  const first = parseDate(from);
  const last = parseDate(to);
  const distance = last.getTime() - first.getTime();
  if (distance < 0 || distance >= 31 * DAY_MS) {
    throw new AppError('DADOS_INVALIDOS', 'O período deve ter de 1 a 31 dias, em ordem crescente.');
  }
  return {
    fromInclusive: startOfLocalDay(first),
    toExclusive: startOfLocalDay(new Date(last.getTime() + DAY_MS)),
  };
}
