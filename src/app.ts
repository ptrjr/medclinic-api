import express, { type Express, type RequestHandler } from 'express';
import type { AuthController } from './controllers/auth.controller';
import type { UserController } from './controllers/user.controller';
import { AppError } from './errors/app-error';
import { createErrorMiddleware, type ErrorLogger } from './middlewares/error.middleware';
import { createAuthRoutes } from './routes/auth.routes';
import { createUserRoutes } from './routes/user.routes';

export interface AppDependencies {
  authController: AuthController;
  userController: UserController;
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
  app.use(() => {
    throw new AppError('RECURSO_NAO_ENCONTRADO', 'Rota não encontrada.');
  });
  app.use(createErrorMiddleware(dependencies.logError));
  return app;
}
