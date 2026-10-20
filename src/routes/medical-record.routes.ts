import { Router, type RequestHandler } from 'express';
import type { MedicalRecordController } from '../controllers/medical-record.controller';
import { UserRole } from '../domain/user';
import { requireRoles } from '../middlewares/role.middleware';

export function createMedicalRecordRoutes(
  controller: MedicalRecordController,
  authenticate: RequestHandler,
): Router {
  const routes = Router();
  routes.post(
    '/:patientId/medical-records',
    authenticate,
    requireRoles(UserRole.DOCTOR),
    (request, response) => controller.create(request, response),
  );
  routes.get(
    '/:patientId/medical-records',
    authenticate,
    requireRoles(UserRole.DOCTOR, UserRole.ADMIN),
    (request, response) => controller.list(request, response),
  );
  return routes;
}
