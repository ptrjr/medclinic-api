import { Router, type RequestHandler } from 'express';
import type { UserController } from '../controllers/user.controller';
import { UserRole } from '../domain/user';
import { requireRoles } from '../middlewares/role.middleware';

export function createUserRoutes(controller: UserController, authenticate: RequestHandler): Router {
  const routes = Router();
  routes.use(authenticate);
  routes.get('/me', (request, response) => controller.me(request, response));
  routes.post('/', requireRoles(UserRole.ADMIN), (request, response) =>
    controller.create(request, response),
  );
  return routes;
}
