import { describe, expect, it, vi } from 'vitest';
import type { Patient } from '../src/domain/patient';
import type { PatientRepositoryPort } from '../src/ports/patient-repository.port';
import { PatientService } from '../src/services/patient.service';

const patient: Patient = {
  id: '20ba7288-1e53-4d79-8a38-4446c4840c28',
  name: 'Maria da Silva',
  cpf: '52998224725',
  birthDate: new Date('1990-03-20T00:00:00Z'),
  phone: '49999999999',
  email: 'maria@example.com',
  createdAt: new Date('2026-10-10T12:00:00Z'),
  updatedAt: new Date('2026-10-10T12:00:00Z'),
};

function repository() {
  return {
    findById: vi.fn<PatientRepositoryPort['findById']>().mockResolvedValue(patient),
    findByCpf: vi.fn<PatientRepositoryPort['findByCpf']>().mockResolvedValue(null),
    list: vi.fn<PatientRepositoryPort['list']>().mockResolvedValue({ items: [patient], total: 1 }),
    create: vi.fn<PatientRepositoryPort['create']>().mockResolvedValue(patient),
    update: vi.fn<PatientRepositoryPort['update']>().mockResolvedValue(patient),
    delete: vi.fn<PatientRepositoryPort['delete']>().mockResolvedValue(true),
  };
}

describe('PatientService', () => {
  it('cria paciente e normaliza e-mail ausente para null', async () => {
    const patients = repository();
    const service = new PatientService(patients);
    await expect(
      service.create({
        name: patient.name,
        cpf: patient.cpf,
        birthDate: patient.birthDate,
        phone: patient.phone,
      }),
    ).resolves.toMatchObject({ id: patient.id, birthDate: '1990-03-20', email: patient.email });
    expect(patients.create).toHaveBeenCalledWith(expect.objectContaining({ email: null }));
  });

  it('recusa CPF já cadastrado antes de criar', async () => {
    const patients = repository();
    patients.findByCpf.mockResolvedValue(patient);
    const service = new PatientService(patients);
    await expect(service.create({ ...patient })).rejects.toMatchObject({
      code: 'CPF_JA_CADASTRADO',
    });
    expect(patients.create).not.toHaveBeenCalled();
  });

  it('lista com paginação e busca', async () => {
    const patients = repository();
    await expect(
      new PatientService(patients).list({ page: 2, limit: 10, search: 'Maria' }),
    ).resolves.toMatchObject({
      total: 1,
      page: 2,
      limit: 10,
      items: [{ id: patient.id }],
    });
    expect(patients.list).toHaveBeenCalledWith(2, 10, 'Maria');
  });

  it('retorna 404 ao consultar paciente inexistente', async () => {
    const patients = repository();
    patients.findById.mockResolvedValue(null);
    await expect(new PatientService(patients).getById(patient.id)).rejects.toMatchObject({
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  });

  it('recusa troca para CPF que pertence a outro paciente', async () => {
    const patients = repository();
    patients.findByCpf.mockResolvedValue({
      ...patient,
      id: 'cc26dc53-40cb-4dcf-99e3-6a60ce59eb51',
    });
    await expect(
      new PatientService(patients).update(patient.id, { cpf: patient.cpf }),
    ).rejects.toMatchObject({
      code: 'CPF_JA_CADASTRADO',
    });
  });

  it('atualiza, exclui e protege contra remoção concorrente', async () => {
    const patients = repository();
    const service = new PatientService(patients);
    await expect(service.update(patient.id, { phone: '49888888888' })).resolves.toMatchObject({
      id: patient.id,
    });
    await expect(service.delete(patient.id)).resolves.toBeUndefined();
    patients.delete.mockResolvedValue(false);
    await expect(service.delete(patient.id)).rejects.toMatchObject({
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  });
});
