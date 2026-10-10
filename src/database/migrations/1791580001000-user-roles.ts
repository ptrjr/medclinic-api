import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserRoles1791580001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN roles TEXT[];
      UPDATE users SET roles = ARRAY[CASE role::text
        WHEN 'Administrador' THEN 'admin' ELSE 'secretary' END];
      ALTER TABLE users ALTER COLUMN roles SET NOT NULL;
      ALTER TABLE users ALTER COLUMN roles SET DEFAULT ARRAY['secretary']::text[];
      ALTER TABLE users ADD CONSTRAINT users_roles_check CHECK (
        cardinality(roles) > 0 AND roles <@ ARRAY['admin','secretary','doctor']::text[]
        AND array_position(roles, NULL) IS NULL
      );
      ALTER TABLE users DROP COLUMN role;
      DROP TYPE users_role_enum;
      ALTER TABLE users ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ
        USING "createdAt" AT TIME ZONE 'UTC';
      ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();
      UPDATE users SET email = lower(trim(email));
      ALTER TABLE users ADD CONSTRAINT users_email_normalized CHECK (email = lower(trim(email)));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // A etapa 1 só suporta um perfil. Não descartamos perfis novos silenciosamente no rollback.
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM users WHERE cardinality(roles) <> 1 OR roles[1] = 'doctor') THEN
          RAISE EXCEPTION 'Rollback bloqueado: usuários com múltiplos perfis ou doctor existem.';
        END IF;
      END $$;
      CREATE TYPE users_role_enum AS ENUM ('Administrador', 'Atendente');
      ALTER TABLE users ADD COLUMN role users_role_enum NOT NULL DEFAULT 'Atendente';
      UPDATE users SET role = CASE WHEN roles[1] = 'admin'
        THEN 'Administrador'::users_role_enum ELSE 'Atendente'::users_role_enum END;
      ALTER TABLE users DROP CONSTRAINT users_roles_check;
      ALTER TABLE users DROP CONSTRAINT users_email_normalized;
      ALTER TABLE users DROP COLUMN roles;
      ALTER TABLE users ALTER COLUMN "createdAt" TYPE TIMESTAMP
        USING "createdAt" AT TIME ZONE 'UTC';
    `);
  }
}
