export enum UserRole {
  ADMIN = 'admin',
  SECRETARY = 'secretary',
  DOCTOR = 'doctor',
}

export interface AuthPrincipal {
  id: string;
  roles: UserRole[];
}

export interface UserAccount extends AuthPrincipal {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface NewUserAccount {
  name: string;
  email: string;
  passwordHash: string;
  roles: UserRole[];
}
