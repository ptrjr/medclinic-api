import type { UserAccount } from './user';

export interface Doctor {
  id: string;
  crm: string;
  user: UserAccount;
}

// A senha já chega em hash; o adaptador cria as duas linhas na mesma transação.
export interface NewDoctor {
  crm: string;
  name: string;
  email: string;
  passwordHash: string;
}

export interface DoctorListQuery {
  page: number;
  pageSize: number;
  name?: string;
}

export interface DoctorPage {
  items: Doctor[];
  total: number;
}
