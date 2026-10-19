import { describe, expect, it } from 'vitest';
import { calendarPeriod, CLINIC_TIME_ZONE } from '../src/rules/calendar-period.rules';

describe('Período inclusivo da agenda no fuso da clínica', () => {
  it('usa America/Sao_Paulo e inclui o dia inteiro das duas pontas', () => {
    const period = calendarPeriod('2026-10-12', '2026-10-16');
    expect(CLINIC_TIME_ZONE).toBe('America/Sao_Paulo');
    expect(period.fromInclusive.toISOString()).toBe('2026-10-12T03:00:00.000Z');
    expect(period.toExclusive.toISOString()).toBe('2026-10-17T03:00:00.000Z');
  });
  it('aceita um dia', () => {
    const period = calendarPeriod('2026-10-13', '2026-10-13');
    expect(period.toExclusive.getTime() - period.fromInclusive.getTime()).toBe(86_400_000);
  });
  it('aceita exatamente 31 dias inclusivos', () => {
    const period = calendarPeriod('2026-10-01', '2026-10-31');
    expect(period.toExclusive.toISOString()).toBe('2026-11-01T03:00:00.000Z');
  });
  it('recusa 32 dias', () => {
    expect(() => calendarPeriod('2026-10-01', '2026-11-01')).toThrow('1 a 31');
  });
  it('recusa período invertido', () => {
    expect(() => calendarPeriod('2026-10-14', '2026-10-13')).toThrow('ordem crescente');
  });
  it.each(['2026-1-01', '01/10/2026', '2026-10-01T00:00:00Z', '2026-10-01 ', ''])(
    'recusa formato %s',
    (from) => {
      expect(() => calendarPeriod(from, '2026-10-13')).toThrow('YYYY-MM-DD');
    },
  );
  it.each(['2026-02-30', '2026-02-29', '2026-13-01', '0000-01-01'])(
    'recusa data impossível %s',
    (date) => {
      expect(() => calendarPeriod(date, date)).toThrow('Data inexistente');
    },
  );
  it('aceita ano bissexto', () => {
    expect(calendarPeriod('2024-02-29', '2024-03-01').fromInclusive.toISOString()).toBe(
      '2024-02-29T03:00:00.000Z',
    );
  });
  it('respeita o início histórico do horário de verão sem meia-noite local', () => {
    const period = calendarPeriod('2018-11-04', '2018-11-04');
    expect(period.fromInclusive.toISOString()).toBe('2018-11-04T03:00:00.000Z');
    expect(period.toExclusive.toISOString()).toBe('2018-11-05T02:00:00.000Z');
    expect(period.toExclusive.getTime() - period.fromInclusive.getTime()).toBe(23 * 3_600_000);
  });
  it('respeita um dia histórico com 25 horas no fim do horário de verão', () => {
    const period = calendarPeriod('2019-02-16', '2019-02-16');
    expect(period.fromInclusive.toISOString()).toBe('2019-02-16T02:00:00.000Z');
    expect(period.toExclusive.toISOString()).toBe('2019-02-17T03:00:00.000Z');
  });
  it('trata datas de quatro dígitos nos extremos suportados sem depender do fuso do servidor', () => {
    const earliest = calendarPeriod('0001-01-01', '0001-01-01');
    const latest = calendarPeriod('9999-12-31', '9999-12-31');
    expect(earliest.fromInclusive.getUTCFullYear()).toBe(1);
    expect(latest.toExclusive.getUTCFullYear()).toBe(10000);
  });
});
