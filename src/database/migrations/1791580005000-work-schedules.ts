import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkSchedules1791580005000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE doctor_work_schedules (
        doctor_id UUID PRIMARY KEY REFERENCES doctors(id) ON DELETE RESTRICT,
        shifts JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT doctor_work_schedules_array CHECK (jsonb_typeof(shifts) = 'array')
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM doctor_work_schedules) THEN
          RAISE EXCEPTION 'Rollback bloqueado: há escalas cadastradas.';
        END IF;
      END $$;
      DROP TABLE doctor_work_schedules;
    `);
  }
}
