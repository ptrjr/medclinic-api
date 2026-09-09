import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { UserRepository } from "../repositories/UserRepository";
import { UserRole } from "../entities/user";
import { AppError } from "../errors/AppError";

interface RegisterUserDTO {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

export class AuthService {
  async register({
    name,
    email,
    password,
    role,
  }: RegisterUserDTO) {
    const existingUser = await UserRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new AppError("E-mail já cadastrado", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = UserRepository.create({
      name,
      email,
      password: hashedPassword,
      role: role ?? UserRole.ATTENDANT,
    });

    await UserRepository.save(user);

    const { password: _, ...userWithoutPassword } = user;

    return userWithoutPassword;
  }

  async login(email: string, password: string) {
    const user = await UserRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new AppError("Credenciais inválidas", 401);
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      throw new AppError("Credenciais inválidas", 401);
    }

    const token = jwt.sign(
      {
        role: user.role,
      },
      process.env.JWT_SECRET as string,
      {
        subject: user.id,
        expiresIn: "1d",
      }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}