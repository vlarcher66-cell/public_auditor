export type UserRole = 'ADMIN' | 'AUDITOR' | 'VIEWER';

export interface User {
  id: number;
  nome: string;
  email: string;
  role: UserRole;
  ativo: boolean;
  ultimo_acesso: string | null;
  criado_em: string;
}
