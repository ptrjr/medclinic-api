import { Router, type RequestHandler } from 'express';
import type { PatientController } from '../controllers/patient.controller';
import { UserRole } from '../domain/user';
import { requireRoles } from '../middlewares/role.middleware';

export function createPatientRoutes(
  controller: PatientController,
  authenticate: RequestHandler,
): Router {
  const routes = Router();
  routes.use(authenticate, requireRoles(UserRole.ADMIN, UserRole.SECRETARY));
  routes.post('/', (request, response) => controller.create(request, response));
  routes.get('/', (request, response) => controller.list(request, response));
  routes.get('/:id', (request, response) => controller.getById(request, response));
  routes.patch('/:id', (request, response) => controller.update(request, response));
  routes.delete('/:id', (request, response) => controller.delete(request, response));
  return routes;
}
