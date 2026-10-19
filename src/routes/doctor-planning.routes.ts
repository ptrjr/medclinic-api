import { Router, type RequestHandler } from 'express';
import type { DoctorPlanningController } from '../controllers/doctor-planning.controller';
import { UserRole } from '../domain/user';
import { requireRoles } from '../middlewares/role.middleware';

export function createDoctorPlanningRoutes(
  controller: DoctorPlanningController,
  authenticate: RequestHandler,
): Router {
  const routes = Router();
  routes.put(
    '/:doctorId/work-schedule',
    authenticate,
    requireRoles(UserRole.ADMIN),
    (request, response) => controller.replaceSchedule(request, response),
  );
  routes.get('/:doctorId/work-schedule', authenticate, (request, response) =>
    controller.getSchedule(request, response),
  );
  routes.get('/:doctorId/calendar', authenticate, (request, response) =>
    controller.getCalendar(request, response),
  );
  return routes;
}
