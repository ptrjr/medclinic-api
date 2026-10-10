import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Patients1791580002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE patients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        cpf VARCHAR(11) NOT NULL UNIQUE,
        birth_date DATE NOT NULL,
        phone VARCHAR(30) NOT NULL,
        email VARCHAR(254),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT patients_cpf_digits_check CHECK (cpf ~ '^[0-9]{11}$')
      );
      CREATE INDEX patients_name_idx ON patients (name);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE patients;');
  }
}
