import { describe, expect, it } from 'vitest';
import { WorkScheduleService } from '../src/services/work-schedule.service';
import { UserRole } from '../src/domain/user';
import { admin } from './doubles';
import { doctor } from './doctor-doubles';
import { createPlanningDoubles, shift } from './planning-doubles';

function fixture() {
  const doubles = createPlanningDoubles();
  return { ...doubles, service: new WorkScheduleService(doubles.doctors, doubles.schedules) };
}

describe('WorkScheduleService', () => {
  it('substitui integralmente, preserva ordem e copia a entrada', async () => {
    const f = fixture();
    const input = { shifts: [{ ...shift, startTime: '14:00', endTime: '18:00' }, shift] };
    const result = await f.service.replace(doctor.id, input, admin);
    expect(result).toEqual(input);
    expect(result.shifts).not.toBe(input.shifts);
    expect(result.shifts[0]).not.toBe(input.shifts[0]);
    expect(f.schedules.replaceShifts).toHaveBeenCalledWith(doctor.id, input.shifts);
    expect(f.appointments.listActiveForDoctor).not.toHaveBeenCalled();
  });
  it('remove todos os turnos com shifts vazio', async () => {
    const f = fixture();
    await expect(f.service.replace(doctor.id, { shifts: [] }, admin)).resolves.toEqual({
      shifts: [],
    });
    expect(f.schedules.replaceShifts).toHaveBeenCalledWith(doctor.id, []);
  });
  it.each([UserRole.DOCTOR, UserRole.SECRETARY])('recusa %s antes de gravar', async (role) => {
    const f = fixture();
    await expect(
      f.service.replace(doctor.id, { shifts: [shift] }, { id: admin.id, roles: [role] }),
    ).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
    expect(f.doctors.findById).not.toHaveBeenCalled();
    expect(f.schedules.replaceShifts).not.toHaveBeenCalled();
  });
  it('aceita admin entre múltiplos perfis', async () => {
    const f = fixture();
    await expect(
      f.service.replace(
        doctor.id,
        { shifts: [shift] },
        { id: admin.id, roles: [UserRole.DOCTOR, UserRole.ADMIN] },
      ),
    ).resolves.toEqual({ shifts: [shift] });
  });
  it('rejeita sobreposição sem substituir a escala anterior', async () => {
    const f = fixture();
    await expect(
      f.service.replace(doctor.id, { shifts: [shift, shift] }, admin),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' });
    expect(f.schedules.replaceShifts).not.toHaveBeenCalled();
  });
  it('get sem escala retorna shifts vazio', async () => {
    const f = fixture();
    f.schedules.getShifts.mockResolvedValue([]);
    await expect(f.service.get(doctor.id)).resolves.toEqual({ shifts: [] });
  });
  it('get retorna escala existente', async () => {
    const f = fixture();
    await expect(f.service.get(doctor.id)).resolves.toEqual({ shifts: [shift] });
  });
  it.each(['get', 'replace'] as const)('%s recusa médico inexistente', async (method) => {
    const f = fixture();
    f.doctors.findById.mockResolvedValue(null);
    const result =
      method === 'get'
        ? f.service.get(doctor.id)
        : f.service.replace(doctor.id, { shifts: [] }, admin);
    await expect(result).rejects.toMatchObject({ code: 'RECURSO_NAO_ENCONTRADO' });
    expect(f.schedules.getShifts).not.toHaveBeenCalled();
    expect(f.schedules.replaceShifts).not.toHaveBeenCalled();
  });
  it('propaga falha de persistência, sem fingir sucesso', async () => {
    const f = fixture();
    f.schedules.replaceShifts.mockRejectedValue(new Error('Banco indisponível'));
    await expect(f.service.replace(doctor.id, { shifts: [] }, admin)).rejects.toThrow(
      'Banco indisponível',
    );
  });
});
