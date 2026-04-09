import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../config/database';
import { isSuperAdmin } from '../config/roles';

const ROLES_VALIDOS = ['SUPER_ADMIN', 'GESTOR', 'CONTADOR', 'AUDITOR', 'VEREADOR', 'VIEWER', 'ADMIN'];

async function tabelaExiste(tabela: string): Promise<boolean> {
  try {
    return await db.schema.hasTable(tabela);
  } catch { return false; }
}

async function colunaExiste(tabela: string, coluna: string): Promise<boolean> {
  try {
    return await db.schema.hasColumn(tabela, coluna);
  } catch { return false; }
}

export async function listUsuarios(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const temMunicipio = await colunaExiste('usuarios', 'fk_municipio');
  const temDimMunicipio = await tabelaExiste('dim_municipio');

  let query;

  if (temMunicipio && temDimMunicipio) {
    query = db('usuarios as u')
      .leftJoin('dim_municipio as m', 'u.fk_municipio', 'm.id')
      .leftJoin('dim_entidade as e', 'u.fk_entidade', 'e.id')
      .select(
        'u.id', 'u.nome', 'u.email', 'u.role', 'u.ativo',
        'u.fk_municipio', 'u.fk_entidade',
        'm.nome as municipio_nome',
        'e.nome as entidade_nome',
        'u.ultimo_acesso', 'u.criado_em',
      )
      .orderBy('u.nome');

    if (!isSuperAdmin(user.role) && user.fk_municipio) {
      query.where('u.fk_municipio', user.fk_municipio);
    }
  } else {
    query = db('usuarios').select('id', 'nome', 'email', 'role', 'ativo', 'ultimo_acesso', 'criado_em').orderBy('nome');
  }

  const rows = await query;
  res.json(rows);
}

export async function createUsuario(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { nome, email, senha, role = 'VIEWER', fk_municipio, fk_entidade } = req.body;

  if (!nome?.trim() || !email?.trim() || !senha) {
    res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    return;
  }
  if (!ROLES_VALIDOS.includes(role)) {
    res.status(400).json({ error: 'Perfil inválido' });
    return;
  }
  if (isSuperAdmin(role) && !isSuperAdmin(user.role)) {
    res.status(403).json({ error: 'Apenas o Super Admin pode criar outro Super Admin' });
    return;
  }

  const exists = await db('usuarios').where({ email: email.trim() }).first();
  if (exists) { res.status(409).json({ error: 'Email já cadastrado' }); return; }

  const temColuna = await colunaExiste('usuarios', 'fk_municipio');
  const municipioFinal = isSuperAdmin(user.role) ? (fk_municipio || null) : (user.fk_municipio || null);

  const senha_hash = await bcrypt.hash(senha, 12);
  const insert: Record<string, any> = {
    nome: nome.trim(),
    email: email.trim().toLowerCase(),
    senha_hash,
    role,
    ativo: true,
    criado_em: new Date(),
  };
  if (temColuna) {
    insert.fk_municipio = municipioFinal;
    insert.fk_entidade = fk_entidade || null;
  }

  const [{ id }] = await db('usuarios').insert(insert).returning('id');
  res.status(201).json({ id, nome: nome.trim(), email, role, ativo: true });
}

export async function updateUsuario(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { id } = req.params;
  const { nome, email, role, ativo, fk_municipio, fk_entidade } = req.body;

  const temColuna = await colunaExiste('usuarios', 'fk_municipio');

  if (temColuna && !isSuperAdmin(user.role)) {
    const alvo = await db('usuarios').where({ id }).first();
    if (alvo?.fk_municipio && alvo.fk_municipio !== user.fk_municipio) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
  }

  const update: Record<string, any> = {};
  if (nome !== undefined) update.nome = nome.trim();
  if (email !== undefined) update.email = email.trim().toLowerCase();
  if (role !== undefined && ROLES_VALIDOS.includes(role)) update.role = role;
  if (ativo !== undefined) update.ativo = ativo;
  if (temColuna && fk_municipio !== undefined && isSuperAdmin(user.role)) update.fk_municipio = fk_municipio || null;
  if (temColuna && fk_entidade !== undefined) update.fk_entidade = fk_entidade || null;

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

// ── Permissões e entidades do usuário ────────────────────────────────────────

export async function getPermissoes(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const [permissoes, entidades] = await Promise.all([
    db('usuario_permissoes').where('fk_usuario', id).select('permissao'),
    db('usuario_entidades').where('fk_usuario', id).select('fk_entidade'),
  ]);
  res.json({
    permissoes: permissoes.map((r: any) => r.permissao),
    entidades_ids: entidades.map((r: any) => r.fk_entidade),
  });
}

export async function savePermissoes(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { permissoes = [], entidades_ids = [] } = req.body as {
    permissoes: string[];
    entidades_ids: number[];
  };

  await db.transaction(async (trx) => {
    // Permissões de menu
    await trx('usuario_permissoes').where('fk_usuario', id).delete();
    if (permissoes.length > 0) {
      await trx('usuario_permissoes').insert(
        permissoes.map((p) => ({ fk_usuario: id, permissao: p }))
      );
    }
    // Entidades acessíveis
    await trx('usuario_entidades').where('fk_usuario', id).delete();
    if (entidades_ids.length > 0) {
      await trx('usuario_entidades').insert(
        entidades_ids.map((e) => ({ fk_usuario: id, fk_entidade: e }))
      );
    }
  });

  res.json({ ok: true });
}

export async function deleteUsuario(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { id } = req.params;

  const target = await db('usuarios').where({ id }).first();
  if (!target) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }

  const temColuna = await colunaExiste('usuarios', 'fk_municipio');
  if (temColuna && !isSuperAdmin(user.role) && target.fk_municipio && target.fk_municipio !== user.fk_municipio) {
    res.status(403).json({ error: 'Acesso negado' }); return;
  }

  await db('usuarios').where({ id }).delete();
  res.json({ message: 'Usuário excluído' });
}
