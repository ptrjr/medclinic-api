import 'dotenv/config';
import { parseAdminEnvironment, parseDatabaseEnvironment } from '../config/environment';
import { createDataSource } from './create-data-source';
import { UserEntity } from '../entities/user.entity';
import { BcryptPasswordHasher } from '../infrastructure/bcrypt-password-hasher';
import { TypeOrmUserRepository } from '../repositories/typeorm-user.repository';
import { AdminSeedService } from '../services/admin-seed.service';

async function main(): Promise<void> {
  const admin = parseAdminEnvironment(process.env);
  const dataSource = createDataSource(parseDatabaseEnvironment(process.env));
  await dataSource.initialize();
  try {
    const service = new AdminSeedService(
      new TypeOrmUserRepository(dataSource.getRepository(UserEntity)),
      new BcryptPasswordHasher(),
    );
    const result = await service.execute({
      name: admin.ADMIN_NAME,
      email: admin.ADMIN_EMAIL,
      password: admin.ADMIN_PASSWORD,
    });
    console.log(
      result === 'created'
        ? 'Administrador inicial criado.'
        : 'Administrador já existe. Credenciais preservadas.',
    );
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha inesperada no seed.');
  process.exitCode = 1;
});
