import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors/app-error';
import { PatientService } from '../src/services/patient.service';
import { createPatientDoubles, patient, patientResponse } from './patient-doubles';

function fixture() {
  const patients = createPatientDoubles();
  return { patients, service: new PatientService(patients) };
}

describe('PatientService', () => {
  it('cria somente com name/cpf e serializa a resposta pública', async () => {
    const { patients, service } = fixture();
    const input = { name: patient.name, cpf: patient.cpf };
    await expect(service.create(input)).resolves.toEqual(patientResponse);
    expect(patients.create).toHaveBeenCalledWith(input);
  });
  it('recusa CPF já cadastrado antes de criar', async () => {
    const { patients, service } = fixture();
    patients.findByCpf.mockResolvedValue(patient);
    await expect(service.create(patient)).rejects.toMatchObject({ code: 'CPF_JA_CADASTRADO' });
    expect(patients.create).not.toHaveBeenCalled();
  });
  it('propaga o conflito de CPF que surgir entre pré-check e gravação', async () => {
    const { patients, service } = fixture();
    patients.create.mockRejectedValue(new AppError('CPF_JA_CADASTRADO', 'CPF repetido.'));
    await expect(service.create(patient)).rejects.toMatchObject({ code: 'CPF_JA_CADASTRADO' });
  });
  it('consulta paciente', async () => {
    const { patients, service } = fixture();
    await expect(service.getById(patient.id)).resolves.toEqual(patientResponse);
    expect(patients.findById).toHaveBeenCalledWith(patient.id);
  });
  it.each(['getById', 'update', 'delete'] as const)(
    '%s retorna recurso inexistente antes de gravar',
    async (method) => {
      const { patients, service } = fixture();
      patients.findById.mockResolvedValue(null);
      const action =
        method === 'update'
          ? service.update(patient.id, { name: 'Carlos atualizado' })
          : service[method](patient.id);
      await expect(action).rejects.toMatchObject({ code: 'RECURSO_NAO_ENCONTRADO' });
      expect(patients.update).not.toHaveBeenCalled();
      expect(patients.delete).not.toHaveBeenCalled();
    },
  );
  it('lista com busca por name e envelope data/meta', async () => {
    const { patients, service } = fixture();
    patients.list.mockResolvedValue({ items: [patient], total: 21 });
    const query = { page: 2, pageSize: 10, name: 'Carlos' };
    await expect(service.list(query)).resolves.toEqual({
      data: [patientResponse],
      meta: { total: 21, page: 2, pageSize: 10, totalPages: 3 },
    });
    expect(patients.list).toHaveBeenCalledWith(query);
  });
  it('lista vazia retorna totalPages zero', async () => {
    const { patients, service } = fixture();
    patients.list.mockResolvedValue({ items: [], total: 0 });
    await expect(service.list({ page: 1, pageSize: 20 })).resolves.toEqual({
      data: [],
      meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 },
    });
  });
  it('atualiza nome preservando CPF e createdAt', async () => {
    const { patients, service } = fixture();
    patients.update.mockResolvedValue({ ...patient, name: 'Carlos atualizado' });
    await expect(service.update(patient.id, { name: 'Carlos atualizado' })).resolves.toEqual({
      ...patientResponse,
      name: 'Carlos atualizado',
    });
    expect(patients.update).toHaveBeenCalledWith(patient.id, { name: 'Carlos atualizado' });
  });
  it('trata remoção concorrente antes da atualização', async () => {
    const { patients, service } = fixture();
    patients.update.mockResolvedValue(null);
    await expect(service.update(patient.id, { name: 'Carlos atualizado' })).rejects.toMatchObject({
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  });
  it('exclui e trata remoção concorrente', async () => {
    const { patients, service } = fixture();
    await expect(service.delete(patient.id)).resolves.toBeUndefined();
    expect(patients.delete).toHaveBeenCalledWith(patient.id);
    patients.delete.mockResolvedValue(false);
    await expect(service.delete(patient.id)).rejects.toMatchObject({
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  });
});
