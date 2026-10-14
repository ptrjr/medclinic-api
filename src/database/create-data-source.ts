import 'reflect-metadata';
import { DataSource } from 'typeorm';
import type { DatabaseEnvironment } from '../config/environment';
import { UserEntity } from '../entities/user.entity';
import { PatientEntity } from '../entities/patient.entity';
import { DoctorEntity } from '../entities/doctor.entity';
import { Doctors1791580003000 } from './migrations/1791580003000-doctors';
import { Patients1791580002000 } from './migrations/1791580002000-patients';
import { InitialUsers1791580000000 } from './migrations/1791580000000-initial-users';
import { UserRoles1791580001000 } from './migrations/1791580001000-user-roles';

export function createDataSource(config: DatabaseEnvironment): DataSource {
  return new DataSource({
    type: 'postgres',
    host: config.DB_HOST,
    port: config.DB_PORT,
    username: config.DB_USERNAME,
    password: config.DB_PASSWORD,
    database: config.DB_DATABASE,
    ssl: config.DB_SSL ? { rejectUnauthorized: true } : false,
    synchronize: false,
    logging: false,
    entities: [UserEntity, PatientEntity, DoctorEntity],
    migrations: [
      InitialUsers1791580000000,
      UserRoles1791580001000,
      Patients1791580002000,
      Doctors1791580003000,
    ],
    migrationsTransactionMode: 'all',
  });
}
