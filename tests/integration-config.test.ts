import { describe, expect, it } from 'vitest';
import {
  assertIntegrationDatabase,
  integrationDatabase,
  integrationEnvironment,
} from './integration/config';

const explicit = {
  INTEGRATION_DB_HOST: '127.0.0.1',
  INTEGRATION_DB_PORT: '5433',
  INTEGRATION_DB_USERNAME: 'integration',
  INTEGRATION_DB_PASSWORD: 'test-only',
  INTEGRATION_DB_DATABASE: integrationDatabase,
};

describe('Proteção da configuração de integração (sem banco)', () => {
  it.each([
    ['127.0.0.1', '127.0.0.1'],
    ['::1', '::1'],
    ['localhost', '127.0.0.1'],
    [' LOCALHOST ', '127.0.0.1'],
  ])('aceita loopback %s e conecta ao endereço literal %s', (host, expected) => {
    expect(integrationEnvironment({ ...explicit, INTEGRATION_DB_HOST: host }).DB_HOST).toBe(
      expected,
    );
  });

  it.each([
    'production.example.com',
    'db.internal',
    '192.168.1.10',
    '10.0.0.1',
    '8.8.8.8',
    '2001:db8::1',
    '0.0.0.0',
    '::',
    'localhost.example.com',
    '127.0.0.1.example.com',
    '127.0.0.1,production.example.com',
    'postgres://127.0.0.1',
    '/var/run/postgresql',
    '   ',
  ])('recusa host %s mesmo com o nome de banco correto', (host) => {
    expect(() => integrationEnvironment({ ...explicit, INTEGRATION_DB_HOST: host })).toThrow(
      'INTEGRATION_DB_HOST exige loopback local',
    );
  });

  it.each([undefined, '', 'medclinic', 'postgres', 'medclinic_integration_test_copy'])(
    'recusa banco %s antes de abrir conexões',
    (database) => {
      expect(() =>
        integrationEnvironment({ ...explicit, INTEGRATION_DB_DATABASE: database }),
      ).toThrow('banco exclusivo');
      expect(() => assertIntegrationDatabase(database)).toThrow('banco exclusivo');
    },
  );

  it.each(['HOST', 'PORT', 'USERNAME', 'PASSWORD'])('não herda DB_%s', (key) => {
    expect(() =>
      integrationEnvironment({
        ...explicit,
        [`INTEGRATION_DB_${key}`]: undefined,
        [`DB_${key}`]: 'development-value',
      }),
    ).toThrow(`INTEGRATION_DB_${key}`);
  });

  it('usa somente as credenciais explícitas de integração', () => {
    expect(integrationEnvironment({ ...explicit, DB_DATABASE: 'production' })).toMatchObject({
      DB_HOST: '127.0.0.1',
      DB_PORT: 5433,
      DB_USERNAME: 'integration',
      DB_PASSWORD: 'test-only',
      DB_DATABASE: integrationDatabase,
      DB_SSL: false,
    });
  });
});
