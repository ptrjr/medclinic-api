import { Router } from "express";

import { AdminController } from "../controllers/AdminController";
import { authMiddleware } from "../middlewares/authMiddlewares";
import { requireRole } from "../middlewares/roleMiddlewares";
import { UserRole } from "../entities/user";

const adminRoutes = Router();

const adminController = new AdminController();

adminRoutes.get(
  "/ping",
  authMiddleware,
  requireRole(UserRole.ADMIN),
  (request, response) => {
    return adminController.ping(request, response);
  }
);

export { adminRoutes };