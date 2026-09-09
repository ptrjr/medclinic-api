import { Router } from "express";
import { AuthController } from "../controllers/AuthController";

const authRoutes = Router();

const authController = new AuthController();

authRoutes.post("/register", (request, response, next) => {
  return authController.register(request, response, next);
});

authRoutes.post("/login", (request, response, next) => {
  return authController.login(request, response, next);
});

export { authRoutes };