import type { DataSource } from 'typeorm';
import { createApp } from './app';
import type { AppEnvironment } from './config/environment';
import { AuthController } from './controllers/auth.controller';
import { UserController } from './controllers/user.controller';
import { PatientController } from './controllers/patient.controller';
import { DoctorController } from './controllers/doctor.controller';
import { DoctorPlanningController } from './controllers/doctor-planning.controller';
import { WorkScheduleService } from './services/work-schedule.service';
import { DoctorCalendarService } from './services/doctor-calendar.service';
import { TypeOrmWorkScheduleRepository } from './repositories/typeorm-work-schedule.repository';
import { TypeOrmCalendarAppointmentsRepository } from './repositories/typeorm-calendar-appointments.repository';
import { AppointmentEntity } from './entities/appointment.entity';
import { AppointmentController } from './controllers/appointment.controller';
import { AppointmentService } from './services/appointment.service';
import { TypeOrmAppointmentRepository } from './repositories/typeorm-appointment.repository';
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
  const schedules = new TypeOrmWorkScheduleRepository(dataSource);
  const appointments = new TypeOrmCalendarAppointmentsRepository(
    dataSource.getRepository(AppointmentEntity),
  );
  const appointmentRepository = new TypeOrmAppointmentRepository(dataSource);
  const tokens = new JwtTokenProvider(config.JWT_SECRET, config.JWT_EXPIRES_IN);
  const authService = new AuthService(users, passwords, tokens);
  const userService = new UserService(users, passwords);
  return createApp({
    authController: new AuthController(authService),
    userController: new UserController(userService),
    patientController: new PatientController(new PatientService(patients)),
    doctorController: new DoctorController(new DoctorService(doctors, users, passwords)),
    doctorPlanningController: new DoctorPlanningController(
      new WorkScheduleService(doctors, schedules),
      new DoctorCalendarService(doctors, schedules, appointments),
    ),
    appointmentController: new AppointmentController(
      new AppointmentService(appointmentRepository, doctors),
    ),
    authenticate: createAuthMiddleware(tokens),
  });
}
