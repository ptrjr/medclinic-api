import { Router, type RequestHandler } from 'express';
import type { AppointmentController } from '../controllers/appointment.controller';
import { UserRole } from '../domain/user';
import { requireRoles } from '../middlewares/role.middleware';

export function createAppointmentRoutes(
  controller: AppointmentController,
  authenticate: RequestHandler,
): Router {
  const routes = Router();
  routes.use(authenticate);
  routes.post('/', requireRoles(UserRole.ADMIN, UserRole.SECRETARY), (request, response) =>
    controller.create(request, response),
  );
  routes.get('/', (request, response) => controller.list(request, response));
  routes.get('/:id', (request, response) => controller.getById(request, response));
  routes.patch('/:id/status', (request, response) => controller.changeStatus(request, response));
  return routes;
}
