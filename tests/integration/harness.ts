import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setImmediate } from 'node:timers/promises';
import type { QueryRunner } from 'typeorm';
import { composeApplication } from '../../src/composition-root';
import { createDataSource } from '../../src/database/create-data-source';
import { UserEntity } from '../../src/entities/user.entity';
import { BcryptPasswordHasher } from '../../src/infrastructure/bcrypt-password-hasher';
import { TypeOrmUserRepository } from '../../src/repositories/typeorm-user.repository';
import { AdminSeedService } from '../../src/services/admin-seed.service';
import { assertIntegrationDatabase, integrationEnvironment } from './config';

export interface HttpResult {
  status: number;
  body: Record<string, unknown>;
}

export class IntegrationHarness {
  public readonly config = integrationEnvironment(process.env);
  public readonly source = createDataSource(this.config);
  public readonly applicationName = `medclinic-integration-${randomUUID()}`;
  public token = '';
  private server?: Server;
  private baseUrl = '';
  private owner?: QueryRunner;
  private ownsDatabase = false;

  constructor() {
    this.source.setOptions({
      extra: {
        application_name: this.applicationName,
        max: 10,
        connectionTimeoutMillis: 5000,
        statement_timeout: 12000,
        idle_in_transaction_session_timeout: 20000,
      },
    });
  }

  public async start(): Promise<void> {
    try {
      // initialize does not run migrations or synchronize the schema.
      await this.source.initialize();
      await this.assertTarget();
      const [version] = await this.source.query<{ version: number }[]>(
        "SELECT current_setting('server_version_num')::int AS version",
      );
      if (version.version < 160000 || version.version >= 170000) {
        throw new Error('Integração exige PostgreSQL 16 real.');
      }
      this.owner = this.source.createQueryRunner();
      await this.owner.connect();
      const [lock] = await this.owner.query('SELECT pg_try_advisory_lock(179158, 16) AS acquired');
      if (!lock.acquired) throw new Error('Outra suíte já utiliza o banco de integração.');
      this.ownsDatabase = true;
      await this.resetSchema();
      await this.source.runMigrations();
      const app = composeApplication(this.source, this.config);
      this.server = app.listen(0, '127.0.0.1');
      await once(this.server, 'listening');
      this.baseUrl = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/api/v1`;
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  public async assertTarget(): Promise<void> {
    assertIntegrationDatabase(this.source.options.database);
    const [target] = await this.source.query<{ database: string }[]>(
      'SELECT current_database() AS database',
    );
    assertIntegrationDatabase(target.database);
  }

  private async resetSchema(): Promise<void> {
    await this.assertTarget();
    if (!this.ownsDatabase) throw new Error('Banco de integração sem posse exclusiva.');
    await this.source.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  }

  public async seedAdmin(): Promise<void> {
    await this.assertTarget();
    await new AdminSeedService(
      new TypeOrmUserRepository(this.source.getRepository(UserEntity)),
      new BcryptPasswordHasher(),
    ).execute({ name: 'Integration Admin', email: 'admin@integration.test', password: password });
    const login = await this.request('/auth/login', {
      email: 'admin@integration.test',
      password,
    });
    if (login.status !== 200 || typeof login.body.accessToken !== 'string') {
      throw new Error('Seed de integração não autenticou.');
    }
    this.token = login.body.accessToken;
  }

  public async clearData(): Promise<void> {
    await this.assertTarget();
    await this.source.query(
      'TRUNCATE medical_records, appointments, doctor_work_schedules, doctors, patients, users',
    );
  }

  public async request(path: string, body: unknown, method = 'POST', token = this.token) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  // Poll observable lock state, yielding to HTTP handlers without timing sleeps.
  public async waitForBlockedRequests(blockerPid: number, count: number, queryText: string) {
    const deadline = Date.now() + 8000;
    let last: { pid: number; blockers: number[]; query: string }[] = [];
    while (Date.now() < deadline) {
      last = await this.source.query(
        `SELECT pid, pg_blocking_pids(pid) AS blockers, query
         FROM pg_stat_activity
         WHERE datname = current_database() AND application_name = $1
           AND wait_event_type = 'Lock' AND state = 'active'`,
        [this.applicationName],
      );
      const reachesControl = (pid: number, visited = new Set<number>()): boolean => {
        if (pid === blockerPid) return true;
        if (visited.has(pid)) return false;
        visited.add(pid);
        return (
          last.find((row) => row.pid === pid)?.blockers.some((id) => reachesControl(id, visited)) ??
          false
        );
      };
      const contenders = last.filter(
        (row) => row.pid !== blockerPid && row.query.includes(queryText) && reachesControl(row.pid),
      );
      if (contenders.length === count) {
        console.log(
          `Contenção comprovada: controle=${blockerPid}, HTTP=${contenders.map((r) => r.pid).join(',')}`,
        );
        return contenders;
      }
      await setImmediate();
    }
    throw new Error(`Não observou ${count} conexões HTTP bloqueadas: ${JSON.stringify(last)}`);
  }

  public async withContention(
    lock: (control: QueryRunner) => Promise<unknown>,
    queryText: string,
    requests: (() => Promise<HttpResult>)[],
  ): Promise<HttpResult[]> {
    await this.assertTarget();
    const control = this.source.createQueryRunner();
    const pending: Promise<HttpResult>[] = [];
    try {
      await control.connect();
      await control.startTransaction();
      const [{ pid }] = await control.query('SELECT pg_backend_pid() AS pid');
      await lock(control);
      // Attach rejection handlers immediately, including on the failure path.
      for (const request of requests) {
        const result = request();
        void result.catch(() => undefined);
        pending.push(result);
      }
      await this.waitForBlockedRequests(pid, requests.length, queryText);
      await control.commitTransaction();
      return await Promise.all(pending);
    } finally {
      try {
        if (control.isTransactionActive) await control.rollbackTransaction();
      } finally {
        await control.release();
        await Promise.allSettled(pending);
      }
    }
  }

  public async close(): Promise<void> {
    try {
      if (this.server) {
        const server = this.server;
        this.server = undefined;
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeAllConnections();
        });
      }
    } finally {
      try {
        if (this.ownsDatabase && this.source.isInitialized) await this.resetSchema();
      } finally {
        this.ownsDatabase = false;
        try {
          if (this.owner && !this.owner.isReleased) {
            try {
              await this.owner.query('SELECT pg_advisory_unlock(179158, 16)');
            } finally {
              await this.owner.release();
            }
          }
        } finally {
          if (this.source.isInitialized) await this.source.destroy();
        }
      }
    }
  }
}

export const password = 'Integration@123';
