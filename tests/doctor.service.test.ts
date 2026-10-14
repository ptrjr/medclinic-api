import { describe, expect, it } from 'vitest';
import { UserRole } from '../src/domain/user';
import { AppError } from '../src/errors/app-error';
import { DoctorService } from '../src/services/doctor.service';
import { admin } from './doubles';
import { createDoctorDoubles, doctor, doctorInput } from './doctor-doubles';

function fixture() {
  const doubles = createDoctorDoubles();
  return {
    ...doubles,
    service: new DoctorService(doubles.doctors, doubles.users, doubles.passwords),
  };
}

describe('DoctorService', () => {
  it('cria por porta atômica usando hash e retorna apenas os campos públicos', async () => {
    const f = fixture();
    const result = await f.service.create(doctorInput, admin);
    expect(f.passwords.hash).toHaveBeenCalledWith(doctorInput.password);
    expect(f.doctors.createWithUser).toHaveBeenCalledWith({
      name: doctorInput.name,
      email: doctorInput.email,
      crm: doctorInput.crm,
      passwordHash: 'hash-gerado',
    });
    expect(f.users.createUser).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: doctor.id,
      crm: doctor.crm,
      user: {
        id: doctor.user.id,
        name: doctor.user.name,
        email: doctor.user.email,
        roles: ['doctor'],
      },
    });
  });

  it.each([UserRole.DOCTOR, UserRole.SECRETARY])(
    'recusa criação por %s antes de acessar o banco',
    async (role) => {
      const f = fixture();
      await expect(
        f.service.create(doctorInput, { id: admin.id, roles: [role] }),
      ).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
      expect(f.users.findByEmail).not.toHaveBeenCalled();
      expect(f.doctors.createWithUser).not.toHaveBeenCalled();
    },
  );

  it('admite admin entre múltiplos perfis', async () => {
    const f = fixture();
    await expect(
      f.service.create(doctorInput, { id: admin.id, roles: [UserRole.DOCTOR, UserRole.ADMIN] }),
    ).resolves.toMatchObject({ crm: doctor.crm });
  });

  it('recusa e-mail repetido antes de calcular hash ou criar', async () => {
    const f = fixture();
    f.users.findByEmail.mockResolvedValue(doctor.user);
    await expect(f.service.create(doctorInput, admin)).rejects.toMatchObject({
      code: 'EMAIL_JA_CADASTRADO',
    });
    expect(f.passwords.hash).not.toHaveBeenCalled();
    expect(f.doctors.createWithUser).not.toHaveBeenCalled();
  });

  it('recusa CRM repetido sem criar usuário avulso', async () => {
    const f = fixture();
    f.doctors.findByCrm.mockResolvedValue(doctor);
    await expect(f.service.create(doctorInput, admin)).rejects.toMatchObject({
      code: 'CRM_JA_CADASTRADO',
    });
    expect(f.passwords.hash).not.toHaveBeenCalled();
    expect(f.users.createUser).not.toHaveBeenCalled();
    expect(f.doctors.createWithUser).not.toHaveBeenCalled();
  });

  it.each(['CRM_JA_CADASTRADO', 'EMAIL_JA_CADASTRADO'] as const)(
    'propaga %s concorrente retornado pelo adaptador',
    async (code) => {
      const f = fixture();
      f.doctors.createWithUser.mockRejectedValue(new AppError(code, 'Conflito concorrente.'));
      await expect(f.service.create(doctorInput, admin)).rejects.toMatchObject({ code });
    },
  );

  it('não tenta gravar se o hash falhar', async () => {
    const f = fixture();
    f.passwords.hash.mockRejectedValue(new Error('Hash falhou'));
    await expect(f.service.create(doctorInput, admin)).rejects.toThrow('Hash falhou');
    expect(f.doctors.createWithUser).not.toHaveBeenCalled();
  });

  it('consulta médico sem expor senha', async () => {
    const f = fixture();
    const result = await f.service.getById(doctor.id);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).not.toHaveProperty('password');
    expect(f.doctors.findById).toHaveBeenCalledWith(doctor.id);
  });

  it('devolve recurso inexistente', async () => {
    const f = fixture();
    f.doctors.findById.mockResolvedValue(null);
    await expect(f.service.getById(doctor.id)).rejects.toMatchObject({
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  });

  it('lista com o envelope literal data/meta e calcula totalPages', async () => {
    const f = fixture();
    f.doctors.list.mockResolvedValue({ items: [doctor], total: 21 });
    const query = { page: 2, pageSize: 20, name: 'Helena' };
    const result = await f.service.list(query);
    expect(f.doctors.list).toHaveBeenCalledWith(query);
    expect(result.meta).toEqual({ total: 21, page: 2, pageSize: 20, totalPages: 2 });
    expect(result.data[0].crm).toBe(doctor.crm);
    expect(result.data[0].user).not.toHaveProperty('passwordHash');
  });

  it('lista vazia possui totalPages zero', async () => {
    const f = fixture();
    f.doctors.list.mockResolvedValue({ items: [], total: 0 });
    await expect(f.service.list({ page: 1, pageSize: 20 })).resolves.toEqual({
      data: [],
      meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 },
    });
  });
});
