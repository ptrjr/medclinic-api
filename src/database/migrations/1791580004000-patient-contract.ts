import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PatientContract1791580004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // A migration original já foi publicada: evoluímos sem reescrever o histórico.
    await queryRunner.query(`
      ALTER TABLE patients ALTER COLUMN birth_date DROP NOT NULL;
      ALTER TABLE patients ALTER COLUMN phone DROP NOT NULL;
      ALTER TABLE patients ADD COLUMN deleted_at TIMESTAMPTZ;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM patients WHERE birth_date IS NULL OR phone IS NULL OR deleted_at IS NOT NULL) THEN
          RAISE EXCEPTION 'Rollback bloqueado: pacientes sem dados legados ou removidos existem.';
        END IF;
      END $$;
      ALTER TABLE patients DROP COLUMN deleted_at;
      ALTER TABLE patients ALTER COLUMN birth_date SET NOT NULL;
      ALTER TABLE patients ALTER COLUMN phone SET NOT NULL;
    `);
  }
}
