import { describe, expect, it } from 'vitest';
import { assertValidWorkShifts } from '../src/rules/work-schedule.rules';
import { shift } from './planning-doubles';

describe('Regras dos turnos', () => {
  it('aceita escala vazia', () => {
    expect(() => assertValidWorkShifts([])).not.toThrow();
  });
  it('aceita um turno', () => {
    expect(() => assertValidWorkShifts([shift])).not.toThrow();
  });
  it('aceita turnos encostados, com durações distintas', () => {
    expect(() =>
      assertValidWorkShifts([
        shift,
        { ...shift, startTime: '12:00', endTime: '18:00', slotDurationMinutes: 20 },
      ]),
    ).not.toThrow();
  });
  it('aceita turnos do mesmo horário em dias diferentes', () => {
    expect(() => assertValidWorkShifts([shift, { ...shift, weekDay: 4 }])).not.toThrow();
  });
  it('valida uma cópia sem reordenar a entrada', () => {
    const afternoon = { ...shift, startTime: '14:00', endTime: '18:00' };
    const input = [afternoon, shift];
    expect(() => assertValidWorkShifts(input)).not.toThrow();
    expect(input).toEqual([afternoon, shift]);
  });
  it.each([-1, 7, 1.5])('recusa weekDay %s', (weekDay) => {
    expect(() => assertValidWorkShifts([{ ...shift, weekDay }])).toThrow('Dia da semana');
  });
  it.each([0, -1, 1.5, NaN, Infinity])('recusa duração %s', (slotDurationMinutes) => {
    expect(() => assertValidWorkShifts([{ ...shift, slotDurationMinutes }])).toThrow(
      'inteiro positivo',
    );
  });
  it.each(['8:00', '08:0', '24:00', '08:60', 'abc'])('recusa hora inválida %s', (startTime) => {
    expect(() => assertValidWorkShifts([{ ...shift, startTime }])).toThrow('HH:MM');
  });
  it('também valida o formato do fim', () => {
    expect(() => assertValidWorkShifts([{ ...shift, endTime: '24:00' }])).toThrow('HH:MM');
  });
  it.each(['08:00', '07:00'])('recusa fim %s menor/igual ao início', (endTime) => {
    expect(() => assertValidWorkShifts([{ ...shift, endTime }])).toThrow('anterior ao fim');
  });
  it.each([
    { ...shift, startTime: '11:00', endTime: '13:00' },
    { ...shift, startTime: '09:00', endTime: '10:00' },
    { ...shift, startTime: '07:00', endTime: '13:00' },
    { ...shift },
  ])('recusa turnos sobrepostos/contidos/iguais: %j', (other) => {
    expect(() => assertValidWorkShifts([shift, other])).toThrow('se sobrepor');
  });
});
