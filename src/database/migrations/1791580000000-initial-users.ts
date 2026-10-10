import type { MigrationInterface, QueryRunner } from 'typeorm';

// Reconhece a tabela da etapa 1, quando existente, e cria a mesma base em banco vazio.
export class InitialUsers1791580000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_role_enum') THEN
          CREATE TYPE users_role_enum AS ENUM ('Administrador', 'Atendente');
        END IF;
      END $$;
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        email VARCHAR NOT NULL UNIQUE,
        password VARCHAR NOT NULL,
        role users_role_enum NOT NULL DEFAULT 'Atendente',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE users; DROP TYPE users_role_enum;');
  }
}
