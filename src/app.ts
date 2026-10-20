import express, { type Express, type RequestHandler } from 'express';
import type { AuthController } from './controllers/auth.controller';
import type { UserController } from './controllers/user.controller';
import type { PatientController } from './controllers/patient.controller';
import type { DoctorController } from './controllers/doctor.controller';
import type { DoctorPlanningController } from './controllers/doctor-planning.controller';
import type { AppointmentController } from './controllers/appointment.controller';
import type { MedicalRecordController } from './controllers/medical-record.controller';
import { AppError } from './errors/app-error';
import { createErrorMiddleware, type ErrorLogger } from './middlewares/error.middleware';
import { createAuthRoutes } from './routes/auth.routes';
import { createUserRoutes } from './routes/user.routes';
import { createPatientRoutes } from './routes/patient.routes';
import { createDoctorRoutes } from './routes/doctor.routes';
import { createDoctorPlanningRoutes } from './routes/doctor-planning.routes';
import { createAppointmentRoutes } from './routes/appointment.routes';
import { createMedicalRecordRoutes } from './routes/medical-record.routes';

export interface AppDependencies {
  authController: AuthController;
  userController: UserController;
  patientController: PatientController;
  doctorController: DoctorController;
  doctorPlanningController: DoctorPlanningController;
  appointmentController: AppointmentController;
  medicalRecordController: MedicalRecordController;
  authenticate: RequestHandler;
  logError?: ErrorLogger;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/v1/health', (_request, response) => response.status(200).json({ status: 'ok' }));
  app.use('/api/v1/auth', createAuthRoutes(dependencies.authController));
  app.use(
    '/api/v1/users',
    createUserRoutes(dependencies.userController, dependencies.authenticate),
  );
  app.use(
    '/api/v1/patients',
    createMedicalRecordRoutes(dependencies.medicalRecordController, dependencies.authenticate),
  );
  app.use(
    '/api/v1/patients',
    createPatientRoutes(dependencies.patientController, dependencies.authenticate),
  );
  app.use(
    '/api/v1/doctors',
    createDoctorPlanningRoutes(dependencies.doctorPlanningController, dependencies.authenticate),
  );
  app.use(
    '/api/v1/doctors',
    createDoctorRoutes(dependencies.doctorController, dependencies.authenticate),
  );
  app.use(
    '/api/v1/appointments',
    createAppointmentRoutes(dependencies.appointmentController, dependencies.authenticate),
  );
  app.use(() => {
    throw new AppError('RECURSO_NAO_ENCONTRADO', 'Rota não encontrada.');
  });
  app.use(createErrorMiddleware(dependencies.logError));
  return app;
}
