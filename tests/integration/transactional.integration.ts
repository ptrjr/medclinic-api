import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DoctorResponse } from '../../src/dtos/doctor.dto';
import { UserEntity } from '../../src/entities/user.entity';
import { DoctorEntity } from '../../src/entities/doctor.entity';
import { AppointmentEntity } from '../../src/entities/appointment.entity';
import { AppointmentStatus } from '../../src/domain/appointment';
import { IntegrationHarness, password } from './harness';

let harness: IntegrationHarness;
let sequence = 0;

beforeAll(async () => {
  harness = new IntegrationHarness();
  await harness.start();
});
beforeEach(async () => {
  await harness.seedAdmin();
});
afterEach(async () => {
  if (harness?.source.isInitialized) await harness.clearData();
});
afterAll(async () => {
  if (harness) await harness.close();
});

function doctorInput(crm = `CRM-${++sequence}`) {
  return {
    name: 'Integration Doctor',
    email: `doctor-${++sequence}@integration.test`,
    password,
    crm,
  };
}

async function createDoctor() {
  const result = await harness.request('/doctors', doctorInput());
  expect(result.status).toBe(201);
  return result.body as unknown as DoctorResponse;
}

async function createPatient() {
  const result = await harness.request('/patients', {
    name: 'Integration Patient',
    cpf: String(++sequence).padStart(11, '0'),
  });
  expect(result.status).toBe(201);
  expect(result.body.id).toEqual(expect.any(String));
  return result.body.id as string;
}

async function schedule(doctorId: string) {
  const result = await harness.request(
    `/doctors/${doctorId}/work-schedule`,
    {
      shifts: [{ weekDay: 2, startTime: '08:00', endTime: '12:00', slotDurationMinutes: 30 }],
    },
    'PUT',
  );
  expect(result.status).toBe(200);
}

const startsAt = '2026-10-20T08:00:00-03:00';

// Only installed in the guarded disposable database. A sequence survives rollback,
// proving that each trigger saw the user inserted by its own real transaction.
async function withDoctorTrigger(mode: 'fail' | 'gate', run: () => Promise<void>) {
  await harness.assertTarget();
  try {
    await harness.source.query(`
      CREATE SEQUENCE integration_user_seen;
      CREATE FUNCTION integration_doctor_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF current_database() <> 'medclinic_integration_test' THEN
          RAISE EXCEPTION 'Unsafe integration database';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND roles = ARRAY['doctor']::text[]) THEN
          RAISE EXCEPTION 'User insert was not visible before doctor insert';
        END IF;
        PERFORM nextval('integration_user_seen');
        ${mode === 'fail' ? "RAISE EXCEPTION 'Integration: forced doctor INSERT failure after user INSERT';" : 'PERFORM pg_advisory_xact_lock(179158, 17);'}
        RETURN NEW;
      END $$;
      CREATE TRIGGER integration_doctor_insert BEFORE INSERT ON doctors
        FOR EACH ROW EXECUTE FUNCTION integration_doctor_insert();
    `);
    await run();
  } finally {
    await harness.assertTarget();
    await harness.source.query(`
      DROP TRIGGER IF EXISTS integration_doctor_insert ON doctors;
      DROP FUNCTION IF EXISTS integration_doctor_insert();
      DROP SEQUENCE IF EXISTS integration_user_seen;
    `);
  }
}

async function expectUserInserts(count: number) {
  const [seen] = await harness.source.query(
    'SELECT last_value, is_called FROM integration_user_seen',
  );
  expect(seen.is_called).toBe(true);
  expect(Number(seen.last_value)).toBe(count);
}

describe('Médicos: HTTP, composição real e transações PostgreSQL 16', () => {
  it('cria médico e autentica o usuário com a senha fornecida', async () => {
    const input = doctorInput();
    const result = await harness.request('/doctors', input);
    expect(result).toMatchObject({
      status: 201,
      body: { crm: input.crm, user: { email: input.email, roles: ['doctor'] } },
    });
    expect(JSON.stringify(result.body)).not.toMatch(/password/i);
    const login = await harness.request('/auth/login', { email: input.email, password });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toEqual(expect.any(String));
    const user = await harness.source
      .getRepository(UserEntity)
      .findOneByOrFail({ email: input.email });
    expect(user.passwordHash).not.toBe(password);
    expect(user.passwordHash).toMatch(/^\$2[ab]\$/);
    expect(await harness.source.getRepository(DoctorEntity).countBy({ userId: user.id })).toBe(1);
  });

  it('reverte o usuário quando o INSERT do médico falha depois do INSERT do usuário', async () => {
    const input = doctorInput();
    await withDoctorTrigger('fail', async () => {
      expect(await harness.request('/doctors', input)).toEqual({
        status: 500,
        body: { statusCode: 500, error: 'ERRO_INTERNO', message: 'Erro interno do servidor.' },
      });
      await expectUserInserts(1);
      expect(await harness.source.getRepository(UserEntity).countBy({ email: input.email })).toBe(
        0,
      );
      expect(await harness.source.getRepository(DoctorEntity).count()).toBe(0);
      expect(await harness.request('/auth/login', { email: input.email, password })).toMatchObject({
        status: 401,
        body: { error: 'CREDENCIAIS_INVALIDAS' },
      });
    });
  });

  it('traduz o UNIQUE de CRM em 409 e reverte o perdedor após ambos passarem pelo pré-check', async () => {
    const inputs = [doctorInput('CRM-RACE'), doctorInput('CRM-RACE')];
    await withDoctorTrigger('gate', async () => {
      const results = await harness.withContention(
        (control) => control.query('SELECT pg_advisory_xact_lock(179158, 17)'),
        'INSERT INTO "doctors"',
        inputs.map((input) => () => harness.request('/doctors', input)),
      );
      expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
      expect(results.find((result) => result.status === 409)?.body).toMatchObject({
        statusCode: 409,
        error: 'CRM_JA_CADASTRADO',
      });
      await expectUserInserts(2);
      const users = harness.source.getRepository(UserEntity);
      for (const [index, result] of results.entries()) {
        expect(await users.countBy({ email: inputs[index].email })).toBe(
          result.status === 201 ? 1 : 0,
        );
        const login = await harness.request('/auth/login', {
          email: inputs[index].email,
          password,
        });
        expect(login.status).toBe(result.status === 201 ? 200 : 401);
      }
      expect(await users.count()).toBe(2); // admin + winner, no orphan
      expect(await harness.source.getRepository(DoctorEntity).countBy({ crm: 'CRM-RACE' })).toBe(1);
    });
  });
});

describe('Agendamentos: contenção observada entre conexões independentes', () => {
  it.each([
    ['médico', 'HORARIO_INDISPONIVEL'],
    ['paciente', 'PACIENTE_INDISPONIVEL'],
  ] as const)('seleciona períodos e exclui cancelled para %s', async (owner, errorCode) => {
    const doctor = await createDoctor();
    const otherDoctor = await createDoctor();
    const patientId = await createPatient();
    const otherPatientId = await createPatient();
    await schedule(doctor.id);
    const repository = harness.source.getRepository(AppointmentEntity);

    for (const [start, end, status, conflicts] of [
      ['10:00', '10:30', AppointmentStatus.SCHEDULED, false],
      ['12:00', '12:30', AppointmentStatus.SCHEDULED, false],
      ['10:30', '11:00', AppointmentStatus.SCHEDULED, false],
      ['11:30', '12:00', AppointmentStatus.SCHEDULED, false],
      ['11:10', '11:20', AppointmentStatus.DONE, true],
      ['10:30', '12:00', AppointmentStatus.IN_PROGRESS, true],
      ['10:45', '11:15', AppointmentStatus.SCHEDULED, true],
      ['11:15', '11:45', AppointmentStatus.SCHEDULED, true],
      ['11:00', '11:30', AppointmentStatus.SCHEDULED, true],
      ['11:00', '11:30', AppointmentStatus.CANCELLED, false],
    ] as const) {
      await repository.save([
        repository.create({
          doctorId: owner === 'médico' ? doctor.id : otherDoctor.id,
          patientId: owner === 'paciente' ? patientId : otherPatientId,
          startsAt: new Date(`2026-10-20T${start}:00Z`),
          endsAt: new Date(`2026-10-20T${end}:00Z`),
          status,
        }),
        // Same time, unrelated owners: must never block this booking.
        repository.create({
          doctorId: otherDoctor.id,
          patientId: otherPatientId,
          startsAt: new Date(startsAt),
          endsAt: new Date('2026-10-20T11:30:00Z'),
          status: AppointmentStatus.SCHEDULED,
        }),
      ]);
      const result = await harness.request('/appointments', {
        doctorId: doctor.id,
        patientId,
        startsAt,
      });
      expect(result.status, `${owner}: ${start}–${end}, ${status}`).toBe(conflicts ? 409 : 201);
      if (conflicts) expect(result.body).toMatchObject({ statusCode: 409, error: errorCode });
      expect(await repository.count()).toBe(conflicts ? 2 : 3);
      await repository.createQueryBuilder().delete().execute();
    }
  });

  it('permite somente uma consulta concorrente para o mesmo médico e horário', async () => {
    const doctor = await createDoctor();
    const patients = [await createPatient(), await createPatient()];
    await schedule(doctor.id);
    const results = await harness.withContention(
      (control) => control.query('SELECT id FROM doctors WHERE id = $1 FOR UPDATE', [doctor.id]),
      'FOR UPDATE',
      patients.map(
        (patientId) => () =>
          harness.request('/appointments', { doctorId: doctor.id, patientId, startsAt }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(results.find((result) => result.status === 409)?.body).toMatchObject({
      statusCode: 409,
      error: 'HORARIO_INDISPONIVEL',
    });
    const winner = results.find((result) => result.status === 201)!;
    const persisted = await harness.source.getRepository(AppointmentEntity).find();
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      id: winner.body.id,
      doctorId: doctor.id,
      patientId: winner.body.patientId,
      startsAt: new Date(startsAt),
      endsAt: new Date('2026-10-20T11:30:00Z'),
      status: 'scheduled',
    });
  });

  it('permite somente uma consulta para o mesmo paciente com médicos diferentes no mesmo período', async () => {
    const doctors = [await createDoctor(), await createDoctor()];
    const patientId = await createPatient();
    for (const doctor of doctors) await schedule(doctor.id);
    const results = await harness.withContention(
      (control) => control.query('SELECT id FROM patients WHERE id = $1 FOR UPDATE', [patientId]),
      'FOR UPDATE',
      doctors.map(
        (doctor) => () =>
          harness.request('/appointments', { doctorId: doctor.id, patientId, startsAt }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(results.find((result) => result.status === 409)?.body).toMatchObject({
      statusCode: 409,
      error: 'PACIENTE_INDISPONIVEL',
    });
    const winner = results.find((result) => result.status === 201)!;
    const persisted = await harness.source.getRepository(AppointmentEntity).find();
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      id: winner.body.id,
      patientId,
      doctorId: winner.body.doctorId,
    });
  });

  it('aceita intervalos encostados para o mesmo médico e paciente', async () => {
    const doctor = await createDoctor();
    const patientId = await createPatient();
    await schedule(doctor.id);
    for (const time of [startsAt, '2026-10-20T08:30:00-03:00']) {
      expect(
        await harness.request('/appointments', { doctorId: doctor.id, patientId, startsAt: time }),
      ).toMatchObject({ status: 201 });
    }
    const persisted = await harness.source.getRepository(AppointmentEntity).find({
      order: { startsAt: 'ASC' },
    });
    expect(persisted).toHaveLength(2);
    expect(persisted[0].endsAt).toEqual(persisted[1].startsAt);
  });
});
