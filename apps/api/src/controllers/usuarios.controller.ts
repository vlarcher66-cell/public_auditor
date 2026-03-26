import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../config/database';

export async function listUsuarios(_req: Request, res: Response): Promise<void> {
  const rows = await db('usuarios')
    .select('id', 'nome', 'email', 'role', 'ativo', 'ultimo_acesso', 'criado_em')
    .orderBy('nome');
  res.json(rows);
}

export async function createUsuario(req: Request, res: Response): Promise<void> {
  const { nome, email, senha, role = 'VIEWER' } = req.body;
  if (!nome?.trim() || !email?.trim() || !senha) {
    res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    return;
  }
  const exists = await db('usuarios').where({ email: email.trim() }).first();
  if (exists) { res.status(409).json({ error: 'Email já cadastrado' }); return; }

  const senha_hash = await bcrypt.hash(senha, 12);
  const [id] = await db('usuarios').insert({
    nome: nome.trim(), email: email.trim().toLowerCase(),
    senha_hash, role, ativo: true, criado_em: new Date(),
  });
  res.status(201).json({ id, nome: nome.trim(), email, role, ativo: true });
}

export async function updateUsuario(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { nome, email, role, ativo } = req.body;
  const update: Record<string, any> = {};
  if (nome !== undefined) update.nome = nome.trim();
  if (email !== undefined) update.email = email.trim().toLowerCase();
  if (role !== undefined) update.role = role;
  if (ativo !== undefined) update.ativo = ativo;
  await db('usuarios').where({ id }).update(update);
  res.json({ message: 'Usuário atualizado' });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { senha } = req.body;
  if (!senha || senha.length < 6) {
    res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' });
    return;
  }
  const senha_hash = await bcrypt.hash(senha, 12);
  await db('usuarios').where({ id }).update({ senha_hash });
  res.json({ message: 'Senha alterada com sucesso' });
}

export async function deleteUsuario(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  // Prevent deleting the last admin
  const admins = await db('usuarios').where({ role: 'ADMIN', ativo: true }).count('id as n').first();
  const target = await db('usuarios').where({ id }).first();
  if (target?.role === 'ADMIN' && Number((admins as any)?.n) <= 1) {
    res.status(409).json({ error: 'Não é possível excluir o único administrador' });
    return;
  }
  await db('usuarios').where({ id }).delete();
  res.json({ message: 'Usuário excluído' });
}
