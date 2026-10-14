import { Router, type RequestHandler } from 'express';
import type { DoctorController } from '../controllers/doctor.controller';
import { UserRole } from '../domain/user';
import { requireRoles } from '../middlewares/role.middleware';

export function createDoctorRoutes(
  controller: DoctorController,
  authenticate: RequestHandler,
): Router {
  const routes = Router();
  routes.use(authenticate);
  routes.post('/', requireRoles(UserRole.ADMIN), (request, response) =>
    controller.create(request, response),
  );
  routes.get('/', (request, response) => controller.list(request, response));
  routes.get('/:id', (request, response) => controller.getById(request, response));
  return routes;
}
