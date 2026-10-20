import 'reflect-metadata';
import { DataSource } from 'typeorm';
import type { DatabaseEnvironment } from '../config/environment';
import { UserEntity } from '../entities/user.entity';
import { PatientEntity } from '../entities/patient.entity';
import { DoctorEntity } from '../entities/doctor.entity';
import { WorkScheduleEntity } from '../entities/work-schedule.entity';
import { AppointmentEntity } from '../entities/appointment.entity';
import { MedicalRecordEntity } from '../entities/medical-record.entity';
import { MedicalRecords1791580007000 } from './migrations/1791580007000-medical-records';
import { WorkSchedules1791580005000 } from './migrations/1791580005000-work-schedules';
import { CalendarAppointments1791580006000 } from './migrations/1791580006000-calendar-appointments';
import { Doctors1791580003000 } from './migrations/1791580003000-doctors';
import { PatientContract1791580004000 } from './migrations/1791580004000-patient-contract';
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
    entities: [
      UserEntity,
      PatientEntity,
      DoctorEntity,
      WorkScheduleEntity,
      AppointmentEntity,
      MedicalRecordEntity,
    ],
    migrations: [
      InitialUsers1791580000000,
      UserRoles1791580001000,
      Patients1791580002000,
      Doctors1791580003000,
      PatientContract1791580004000,
      WorkSchedules1791580005000,
      CalendarAppointments1791580006000,
      MedicalRecords1791580007000,
    ],
    migrationsTransactionMode: 'all',
  });
}
