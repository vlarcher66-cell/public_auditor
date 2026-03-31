import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, senha } = req.body;

  if (!email || !senha) {
    res.status(400).json({ error: 'Email e senha são obrigatórios' });
    return;
  }

  const user = await db('usuarios').where({ email, ativo: true }).first();

  if (!user) {
    res.status(401).json({ error: 'Credenciais inválidas' });
    return;
  }

  const valid = await bcrypt.compare(senha, user.senha_hash);
  if (!valid) {
    res.status(401).json({ error: 'Credenciais inválidas' });
    return;
  }

  await db('usuarios').where({ id: user.id }).update({ ultimo_acesso: new Date() });

  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      fk_municipio: user.fk_municipio ?? null,
      fk_entidade: user.fk_entidade ?? null,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions,
  );

  logger.info({ userId: user.id, email: user.email, fk_municipio: user.fk_municipio }, 'Login bem-sucedido');

  res.json({
    token,
    user: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      fk_municipio: user.fk_municipio ?? null,
      fk_entidade: user.fk_entidade ?? null,
    },
  });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await db('usuarios')
    .where({ id: req.user!.sub, ativo: true })
    .select('id', 'nome', 'email', 'role', 'ultimo_acesso', 'criado_em')
    .first();

  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }

  res.json({
    ...user,
    fk_municipio: req.user!.fk_municipio ?? null,
    fk_entidade: req.user!.fk_entidade ?? null,
  });
}
