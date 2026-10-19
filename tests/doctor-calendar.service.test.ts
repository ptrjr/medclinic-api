import { describe, expect, it } from 'vitest';
import { DoctorCalendarService } from '../src/services/doctor-calendar.service';
import { doctor } from './doctor-doubles';
import { consultation, createPlanningDoubles, shift } from './planning-doubles';

function fixture() {
  const doubles = createPlanningDoubles();
  return {
    ...doubles,
    service: new DoctorCalendarService(doubles.doctors, doubles.schedules, doubles.appointments),
  };
}

describe('DoctorCalendarService', () => {
  it('retorna escala e agendamentos em UTC, sem gerar slots ou vazar dados internos', async () => {
    const f = fixture();
    await expect(
      f.service.get(doctor.id, { from: '2026-10-13', to: '2026-10-13' }),
    ).resolves.toEqual({
      workSchedule: { shifts: [shift] },
      appointments: [
        {
          id: consultation.id,
          patientId: consultation.patientId,
          startsAt: '2026-10-13T11:00:00.000Z',
          endsAt: '2026-10-13T11:30:00.000Z',
          status: 'scheduled',
        },
      ],
    });
    expect(f.appointments.listActiveForDoctor).toHaveBeenCalledWith(
      doctor.id,
      new Date('2026-10-13T03:00:00Z'),
      new Date('2026-10-14T03:00:00Z'),
    );
  });
  it('retorna arrays vazios sem escala/consultas', async () => {
    const f = fixture();
    f.schedules.getShifts.mockResolvedValue([]);
    f.appointments.listActiveForDoctor.mockResolvedValue([]);
    await expect(
      f.service.get(doctor.id, { from: '2026-10-13', to: '2026-10-13' }),
    ).resolves.toEqual({ workSchedule: { shifts: [] }, appointments: [] });
  });
  it('recusa médico inexistente', async () => {
    const f = fixture();
    f.doctors.findById.mockResolvedValue(null);
    await expect(
      f.service.get(doctor.id, { from: '2026-10-13', to: '2026-10-13' }),
    ).rejects.toMatchObject({ code: 'RECURSO_NAO_ENCONTRADO' });
    expect(f.appointments.listActiveForDoctor).not.toHaveBeenCalled();
  });
  it('recusa intervalo inválido antes de consultar o banco', async () => {
    const f = fixture();
    await expect(
      f.service.get(doctor.id, { from: '2026-10-14', to: '2026-10-13' }),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' });
    expect(f.doctors.findById).not.toHaveBeenCalled();
  });
  it('não engole falhas inesperadas do adaptador', async () => {
    const f = fixture();
    f.appointments.listActiveForDoctor.mockRejectedValue(new Error('Falha de consulta'));
    await expect(
      f.service.get(doctor.id, { from: '2026-10-13', to: '2026-10-13' }),
    ).rejects.toThrow('Falha de consulta');
  });
});
