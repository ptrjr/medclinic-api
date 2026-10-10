import type { NewUserAccount, UserAccount } from '../domain/user';

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<UserAccount | null>;
  findById(id: string): Promise<UserAccount | null>;
  createUser(input: NewUserAccount): Promise<UserAccount>;
}
