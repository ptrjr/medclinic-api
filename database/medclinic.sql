CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'users_role_enum'
    ) THEN
        CREATE TYPE users_role_enum AS ENUM (
            'Administrador',
            'Atendente'
        );
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    email VARCHAR NOT NULL UNIQUE,
    password VARCHAR NOT NULL,
    role users_role_enum NOT NULL DEFAULT 'Atendente',
    "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);