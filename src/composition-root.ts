import type { DataSource } from 'typeorm';
import { createApp } from './app';
import type { AppEnvironment } from './config/environment';
import { AuthController } from './controllers/auth.controller';
import { UserController } from './controllers/user.controller';
import { PatientController } from './controllers/patient.controller';
import { DoctorController } from './controllers/doctor.controller';
import { DoctorService } from './services/doctor.service';
import { TypeOrmDoctorRepository } from './repositories/typeorm-doctor.repository';
import { PatientEntity } from './entities/patient.entity';
import { UserEntity } from './entities/user.entity';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { JwtTokenProvider } from './infrastructure/jwt-token-provider';
import { createAuthMiddleware } from './middlewares/auth.middleware';
import { TypeOrmUserRepository } from './repositories/typeorm-user.repository';
import { TypeOrmPatientRepository } from './repositories/typeorm-patient.repository';
import { PatientService } from './services/patient.service';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';

export function composeApplication(dataSource: DataSource, config: AppEnvironment) {
  const users = new TypeOrmUserRepository(dataSource.getRepository(UserEntity));
  const patients = new TypeOrmPatientRepository(dataSource.getRepository(PatientEntity));
  const passwords = new BcryptPasswordHasher();
  const doctors = new TypeOrmDoctorRepository(dataSource);
  const tokens = new JwtTokenProvider(config.JWT_SECRET, config.JWT_EXPIRES_IN);
  const authService = new AuthService(users, passwords, tokens);
  const userService = new UserService(users, passwords);
  return createApp({
    authController: new AuthController(authService),
    userController: new UserController(userService),
    patientController: new PatientController(new PatientService(patients)),
    doctorController: new DoctorController(new DoctorService(doctors, users, passwords)),
    authenticate: createAuthMiddleware(tokens),
  });
}
