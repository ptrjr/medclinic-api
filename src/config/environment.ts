import { z } from 'zod';
import { emailSchema, passwordSchema } from '../dtos/auth.dto';

const databaseSchema = z.object({
  DB_HOST: z.string().trim().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_USERNAME: z.string().trim().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_DATABASE: z.string().trim().min(1),
  DB_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

const appSchema = databaseSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+(?:s|m|h|d)?$/)
    .default('1d')
    .transform((value) => {
      const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
      return Number.parseInt(value, 10) * (units[value.slice(-1)] ?? 1);
    })
    .pipe(z.number().int().positive().max(2592000)),
});

const adminSchema = z.object({
  ADMIN_NAME: z.string().trim().min(1).max(150).default('Administrador'),
  ADMIN_EMAIL: emailSchema,
  ADMIN_PASSWORD: passwordSchema,
});

export type DatabaseEnvironment = z.infer<typeof databaseSchema>;
export type AppEnvironment = z.infer<typeof appSchema>;
export type AdminEnvironment = z.infer<typeof adminSchema>;
type EnvironmentSource = Record<string, string | undefined>;

function readSchema<T>(schema: z.ZodType<T>, source: EnvironmentSource): T {
  const result = schema.safeParse(source);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error('Configuração inválida. Confira as variáveis: ' + fields.join(', ') + '.');
  }
  return result.data;
}

export function parseDatabaseEnvironment(source: EnvironmentSource): DatabaseEnvironment {
  return readSchema(databaseSchema, source);
}

export function parseAppEnvironment(source: EnvironmentSource): AppEnvironment {
  return readSchema(appSchema, source);
}

export function parseAdminEnvironment(source: EnvironmentSource): AdminEnvironment {
  return readSchema(adminSchema, source);
}
