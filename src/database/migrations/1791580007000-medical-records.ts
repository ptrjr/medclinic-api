import type { MigrationInterface, QueryRunner } from 'typeorm';

export class MedicalRecords1791580007000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE medical_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
        doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
        text TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT medical_records_text_check CHECK (char_length(btrim(text)) > 0)
      );
      CREATE INDEX medical_records_patient_created_idx ON medical_records (patient_id, created_at DESC, id DESC);
      CREATE INDEX appointments_care_relationship_idx ON appointments (doctor_id, patient_id) WHERE status IN ('in_progress', 'done');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM medical_records) THEN
          RAISE EXCEPTION 'Rollback bloqueado: há prontuários cadastrados.';
        END IF;
      END $$;
      DROP INDEX appointments_care_relationship_idx;
      DROP TABLE medical_records;
    `);
  }
}
