import { describe, expect, it } from 'vitest';
import { UserRole, type AuthPrincipal } from '../src/domain/user';
import {
  createMedicalRecordSchema,
  listMedicalRecordsQuerySchema,
  toMedicalRecordResponse,
} from '../src/dtos/medical-record.dto';
import { MedicalRecordService } from '../src/services/medical-record.service';
import { admin } from './doubles';
import { doctor } from './doctor-doubles';
import { patient } from './patient-doubles';
import { createMedicalRecordDoubles, medicalRecord } from './medical-record-doubles';

const doctorActor: AuthPrincipal = { id: doctor.user.id, roles: [UserRole.DOCTOR] };
const secretary: AuthPrincipal = { id: 'secretary-id', roles: [UserRole.SECRETARY] };
const query = { page: 1, pageSize: 20 };
const input = { text: medicalRecord.text };

function fixture() {
  const f = createMedicalRecordDoubles();
  return { ...f, service: new MedicalRecordService(f.records, f.patients, f.doctors) };
}

describe('MedicalRecordService.create', () => {
  it('médico com vínculo escreve com sua identidade profissional e data UTC', async () => {
    const f = fixture();
    await expect(f.service.create(patient.id, input, doctorActor)).resolves.toEqual({
      id: medicalRecord.id,
      patientId: patient.id,
      doctorId: doctor.id,
      text: input.text,
      createdAt: '2026-10-19T15:25:00.000Z',
    });
    expect(f.doctors.findByUserId).toHaveBeenCalledWith(doctorActor.id);
    expect(f.records.hasCareRelationship).toHaveBeenCalledWith(doctor.id, patient.id);
    expect(f.records.create).toHaveBeenCalledWith({
      patientId: patient.id,
      doctorId: doctor.id,
      text: input.text,
    });
  });
  it('não repassa doctorId nem patientId do corpo ao repositório', async () => {
    const f = fixture();
    const forgedInput = { ...input, doctorId: 'outro-medico', patientId: 'outro-paciente' };
    await f.service.create(patient.id, forgedInput, doctorActor);
    expect(f.records.create).toHaveBeenCalledWith({
      patientId: patient.id,
      doctorId: doctor.id,
      text: input.text,
    });
  });
  it.each([admin, secretary, { id: 'no-role', roles: [] }])(
    'recusa perfil sem doctor: %j',
    async (actor) => {
      const f = fixture();
      await expect(f.service.create(patient.id, input, actor)).rejects.toMatchObject({
        code: 'ACESSO_NEGADO',
      });
      expect(f.patients.findById).not.toHaveBeenCalled();
      expect(f.records.create).not.toHaveBeenCalled();
    },
  );
  it('perfil adicional admin não dispensa o vínculo para escrever como médico', async () => {
    const f = fixture();
    const actor = { ...doctorActor, roles: [UserRole.ADMIN, UserRole.DOCTOR] };
    await expect(f.service.create(patient.id, input, actor)).resolves.toBeDefined();
    f.records.hasCareRelationship.mockResolvedValue(false);
    await expect(f.service.create(patient.id, input, actor)).rejects.toMatchObject({
      code: 'ACESSO_NEGADO',
    });
    expect(f.records.create).toHaveBeenCalledOnce();
  });
});

describe('Vínculo e existência do paciente', () => {
  it.each(['create', 'list'] as const)(
    '%s recusa médico sem consulta em andamento/concluída',
    async (method) => {
      const f = fixture();
      f.records.hasCareRelationship.mockResolvedValue(false);
      const operation =
        method === 'create'
          ? f.service.create(patient.id, input, doctorActor)
          : f.service.list(patient.id, query, doctorActor);
      await expect(operation).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
      expect(f.records.create).not.toHaveBeenCalled();
      expect(f.records.list).not.toHaveBeenCalled();
    },
  );
  it.each(['create', 'list'] as const)(
    '%s recusa usuário doctor sem registro profissional',
    async (method) => {
      const f = fixture();
      f.doctors.findByUserId.mockResolvedValue(null);
      const operation =
        method === 'create'
          ? f.service.create(patient.id, input, doctorActor)
          : f.service.list(patient.id, query, doctorActor);
      await expect(operation).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
      expect(f.records.hasCareRelationship).not.toHaveBeenCalled();
      expect(f.records.create).not.toHaveBeenCalled();
      expect(f.records.list).not.toHaveBeenCalled();
    },
  );
  it.each(['create', 'list'] as const)(
    '%s devolve 404 antes de consultar vínculo se paciente não existe',
    async (method) => {
      const f = fixture();
      f.patients.findById.mockResolvedValue(null);
      const operation =
        method === 'create'
          ? f.service.create(patient.id, input, doctorActor)
          : f.service.list(patient.id, query, doctorActor);
      await expect(operation).rejects.toMatchObject({ code: 'RECURSO_NAO_ENCONTRADO' });
      expect(f.doctors.findByUserId).not.toHaveBeenCalled();
      expect(f.records.list).not.toHaveBeenCalled();
      expect(f.records.create).not.toHaveBeenCalled();
    },
  );
  it('admin também recebe 404 para paciente inexistente/removido', async () => {
    const f = fixture();
    f.patients.findById.mockResolvedValue(null);
    await expect(f.service.list(patient.id, query, admin)).rejects.toMatchObject({
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  });
  it('avalia o vínculo com o médico encontrado pelo token e o paciente da rota', async () => {
    const f = fixture();
    f.doctors.findByUserId.mockResolvedValue({ ...doctor, id: 'outro-medico' });
    f.records.hasCareRelationship.mockResolvedValue(false);
    await expect(f.service.list(patient.id, query, doctorActor)).rejects.toMatchObject({
      code: 'ACESSO_NEGADO',
    });
    expect(f.records.hasCareRelationship).toHaveBeenCalledWith('outro-medico', patient.id);
  });
});

describe('MedicalRecordService.list', () => {
  it('admin lê para auditoria sem vínculo e sem buscar identidade de médico', async () => {
    const f = fixture();
    f.records.hasCareRelationship.mockResolvedValue(false);
    await expect(f.service.list(patient.id, query, admin)).resolves.toEqual({
      data: [toMedicalRecordResponse(medicalRecord)],
      meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
    });
    expect(f.records.list).toHaveBeenCalledWith(patient.id, query);
    expect(f.doctors.findByUserId).not.toHaveBeenCalled();
    expect(f.records.hasCareRelationship).not.toHaveBeenCalled();
  });
  it('médico com vínculo lê o prontuário do paciente, inclusive registros de outro autor', async () => {
    const f = fixture();
    const recordOfAnotherDoctor = { ...medicalRecord, doctorId: 'another-doctor-id' };
    f.records.list.mockResolvedValue({ items: [recordOfAnotherDoctor], total: 21 });
    await expect(
      f.service.list(patient.id, { page: 2, pageSize: 10 }, doctorActor),
    ).resolves.toEqual({
      data: [toMedicalRecordResponse(recordOfAnotherDoctor)],
      meta: { total: 21, page: 2, pageSize: 10, totalPages: 3 },
    });
    expect(f.records.list).toHaveBeenCalledWith(patient.id, { page: 2, pageSize: 10 });
  });
  it('retorna página vazia com totalPages zero', async () => {
    const f = fixture();
    f.records.list.mockResolvedValue({ items: [], total: 0 });
    await expect(f.service.list(patient.id, query, doctorActor)).resolves.toEqual({
      data: [],
      meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 },
    });
  });
  it.each([secretary, { id: 'no-role', roles: [] }])(
    'recusa leitura sem perfil doctor/admin: %j',
    async (actor) => {
      const f = fixture();
      await expect(f.service.list(patient.id, query, actor)).rejects.toMatchObject({
        code: 'ACESSO_NEGADO',
      });
      expect(f.patients.findById).not.toHaveBeenCalled();
      expect(f.records.list).not.toHaveBeenCalled();
    },
  );
  it('admin com doctor lê por permissão administrativa', async () => {
    const f = fixture();
    await expect(
      f.service.list(patient.id, query, {
        ...doctorActor,
        roles: [UserRole.ADMIN, UserRole.DOCTOR],
      }),
    ).resolves.toBeDefined();
    expect(f.doctors.findByUserId).not.toHaveBeenCalled();
  });
});

describe('DTOs do prontuário', () => {
  it.each([
    {},
    { text: '' },
    { text: ' \t\n ' },
    { text: null },
    { text: 42 },
    { text: [] },
    null,
    [],
  ])('recusa texto/corpo inválido: %j', (body) => {
    expect(createMedicalRecordSchema.safeParse(body).success).toBe(false);
  });
  it.each(['id-falso', 123, null, { id: 'id-falso' }])(
    'ignora doctorId do corpo sem validar ou confiar nele: %j',
    (doctorId) => {
      expect(createMedicalRecordSchema.parse({ text: ' Evolução clínica. ', doctorId })).toEqual({
        text: 'Evolução clínica.',
      });
    },
  );
  it('aceita texto com acentos, quebra de linha e caracteres usados em SQL como dados', () => {
    const text = "Paciente d'Ávila: sem alterações.\nConduta: observar; -- evolução";
    expect(createMedicalRecordSchema.parse({ text })).toEqual({ text });
  });
  it('usa paginação padrão e aceita o limite de 100 registros', () => {
    expect(listMedicalRecordsQuerySchema.parse({})).toEqual(query);
    expect(listMedicalRecordsQuerySchema.parse({ page: '2', pageSize: '100' })).toEqual({
      page: 2,
      pageSize: 100,
    });
  });
  it.each([
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: ['1'] },
    { pageSize: '101' },
    { pageSize: '0' },
    { pageSize: 'abc' },
  ])('recusa paginação inválida: %j', (value) => {
    expect(listMedicalRecordsQuerySchema.safeParse(value).success).toBe(false);
  });
  it('não deixa query acrescentar patientId ou doctorId ao filtro de acesso', () => {
    expect(
      listMedicalRecordsQuerySchema.parse({ patientId: 'outro', doctorId: 'outro', page: '1' }),
    ).toEqual(query);
  });
});
