import { Router } from 'express';
import type { AuthController } from '../controllers/auth.controller';

export function createAuthRoutes(controller: AuthController): Router {
  const routes = Router();
  routes.post('/login', (request, response) => controller.login(request, response));
  return routes;
}
