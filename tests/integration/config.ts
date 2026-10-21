import { parseAppEnvironment } from '../../src/config/environment';

export const integrationDatabase = 'medclinic_integration_test';

export function assertIntegrationDatabase(database: unknown): void {
  if (database !== integrationDatabase) {
    throw new Error(`Integração exige o banco exclusivo ${integrationDatabase}.`);
  }
}

export function integrationEnvironment(source: Record<string, string | undefined>) {
  // Never load dotenv or fall back to DB_* / application credentials.
  assertIntegrationDatabase(source.INTEGRATION_DB_DATABASE);
  for (const name of ['HOST', 'PORT', 'USERNAME', 'PASSWORD']) {
    if (!source[`INTEGRATION_DB_${name}`]) {
      throw new Error(`Configure explicitamente INTEGRATION_DB_${name}.`);
    }
  }
  return parseAppEnvironment({
    DB_HOST: source.INTEGRATION_DB_HOST,
    DB_PORT: source.INTEGRATION_DB_PORT,
    DB_USERNAME: source.INTEGRATION_DB_USERNAME,
    DB_PASSWORD: source.INTEGRATION_DB_PASSWORD,
    DB_DATABASE: source.INTEGRATION_DB_DATABASE,
    DB_SSL: 'false',
    JWT_SECRET: 'integration-only-secret-with-at-least-32-characters',
    JWT_EXPIRES_IN: '1h',
  });
}
