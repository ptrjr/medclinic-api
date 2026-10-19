import type { MigrationInterface, QueryRunner } from 'typeorm';

// Estrutura que permite consultar a agenda; a escrita via API vem no próximo módulo.
export class CalendarAppointments1791580006000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE appointments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
        starts_at TIMESTAMPTZ NOT NULL,
        ends_at TIMESTAMPTZ NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT appointments_period_check CHECK (starts_at < ends_at),
        CONSTRAINT appointments_status_check CHECK (status IN ('scheduled', 'in_progress', 'done', 'cancelled'))
      );
      CREATE INDEX appointments_doctor_active_period_idx ON appointments (doctor_id, starts_at, ends_at) WHERE status <> 'cancelled';
      CREATE INDEX appointments_patient_active_period_idx ON appointments (patient_id, starts_at, ends_at) WHERE status <> 'cancelled';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM appointments) THEN
          RAISE EXCEPTION 'Rollback bloqueado: há agendamentos cadastrados.';
        END IF;
      END $$;
      DROP TABLE appointments;
    `);
  }
}
