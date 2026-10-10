import bcrypt from 'bcrypt';
import type { PasswordHasherPort } from '../ports/password-hasher.port';

export class BcryptPasswordHasher implements PasswordHasherPort {
  public async hash(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  public async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
