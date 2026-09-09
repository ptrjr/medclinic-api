import { Router } from "express";

import { UserController } from "../controllers/UserController";
import { authMiddleware } from "../middlewares/authMiddlewares";

const userRoutes = Router();

const userController = new UserController();

userRoutes.get("/me", authMiddleware, (request, response) => {
  return userController.me(request, response);
});

export { userRoutes };