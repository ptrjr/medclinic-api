import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Doctors1791580003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE doctors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        crm VARCHAR(50) NOT NULL,
        user_id UUID NOT NULL,
        CONSTRAINT doctors_crm_unique UNIQUE (crm),
        CONSTRAINT doctors_user_unique UNIQUE (user_id),
        CONSTRAINT doctors_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT doctors_crm_not_blank CHECK (length(trim(crm)) > 0)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Bloqueia reversão com dados para não deixar usuários doctor sem registro profissional.
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM doctors) THEN
          RAISE EXCEPTION 'Rollback bloqueado: há médicos cadastrados. Use uma base descartável.';
        END IF;
      END $$;
      DROP TABLE doctors;
    `);
  }
}
