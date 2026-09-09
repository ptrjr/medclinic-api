import { Router } from "express";
import { AuthController } from "../controllers/AuthController";

const authRoutes = Router();

const authController = new AuthController();

authRoutes.post("/register", (request, response) => {
  return authController.register(request, response);
});

authRoutes.post("/login", (request, response) => {
  return authController.login(request, response);
});

export { authRoutes };