import { z } from 'zod';
import { UserRole, type UserAccount } from '../domain/user';

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres.')
  .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, {
    message: 'A senha excede o limite de 72 bytes do bcrypt.',
  });

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1),
});

export const createUserSchema = z.strictObject({
  name: z.string().trim().min(1).max(150),
  email: emailSchema,
  password: passwordSchema,
  roles: z.array(z.enum(UserRole)).min(1).max(3),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
}

export function toUserResponse(user: UserAccount): UserResponse {
  return { id: user.id, name: user.name, email: user.email, roles: [...user.roles] };
}
