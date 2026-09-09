import bcrypt from "bcrypt";
import { UserRepository } from "../repositories/UserRepository";
import { UserRole } from "../entities/User";

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
      throw new Error("E-mail já cadastrado");
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
}