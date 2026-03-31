import { Request, Response } from 'express';
import { db } from '../config/database';

// ─── Helper: find-or-create subgrupo prefixado (DEA/RP) ──────────────────────
async function resolverSubgrupoPrefixado(grupoId: number, prefixo: string, subgrupoNome: string): Promise<number> {
  const nomeComPrefixo = `${prefixo} - ${subgrupoNome}`;
  const existing = await db('dim_subgrupo_despesa').where({ nome: nomeComPrefixo, fk_grupo: grupoId }).first();
  if (existing) return existing.id;
  const [novoId] = await db('dim_subgrupo_despesa').insert({ nome: nomeComPrefixo, fk_grupo: grupoId });
  return novoId;
}

export interface RateioItem {
  fk_grupo: number | null;
  fk_subgrupo: number | null;
  valor: number;
}

export async function listRateio(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const pagamento = await db('fact_ordem_pagamento')
    .where({ id })
    .select('rateio_itens')
    .first();

  if (!pagamento) {
    res.status(404).json({ error: 'Pagamento não encontrado' });
    return;
  }

  const itens = pagamento.rateio_itens ? JSON.parse(String(pagamento.rateio_itens)) : [];
  res.json(itens);
}

export async function saveRateio(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { itens } = req.body as { itens: RateioItem[] };

  if (!Array.isArray(itens)) {
    res.status(400).json({ error: 'itens deve ser um array' });
    return;
  }

  // Buscar pagamento + tipo_relatorio
  const pagamento = await db('fact_ordem_pagamento')
    .where({ id })
    .select('valor_bruto', 'fk_credor', 'num_empenho_base', 'fk_setor_pag', 'tipo_relatorio')
    .first();

  if (!pagamento) {
    res.status(404).json({ error: 'Pagamento não encontrado' });
    return;
  }

  // Resolver grupos DEA/RP para travar no grupo correto
  const tipoRelatorio = pagamento.tipo_relatorio; // 'DEA', 'RP', ou 'OR'
  let grupoTravadoId: number | null = null;
  let prefixoTravado: string | null = null;

  if (tipoRelatorio === 'DEA') {
    const g = await db('dim_grupo_despesa').whereRaw("UPPER(nome) LIKE '%EXERC%CIO ANTERIOR%'").select('id').first();
    if (g) { grupoTravadoId = g.id; prefixoTravado = 'DEA'; }
  } else if (tipoRelatorio === 'RP') {
    const g = await db('dim_grupo_despesa').whereRaw("UPPER(nome) LIKE '%RESTOS A PAGAR%'").select('id').first();
    if (g) { grupoTravadoId = g.id; prefixoTravado = 'RP'; }
  }

  // Se DEA/RP: resolve subgrupo prefixado para cada item antes de salvar
  if (grupoTravadoId && prefixoTravado) {
    for (const item of itens) {
      // Força o grupo travado
      item.fk_grupo = grupoTravadoId;

      // Se o item tem subgrupo selecionado, verifica se já é prefixado ou precisa criar
      if (item.fk_subgrupo) {
        const sub = await db('dim_subgrupo_despesa').where({ id: item.fk_subgrupo }).first();
        if (sub) {
          const jaTemPrefixo = sub.nome.startsWith(`${prefixoTravado} - `);
          if (!jaTemPrefixo) {
            // Cria/busca subgrupo prefixado
            item.fk_subgrupo = await resolverSubgrupoPrefixado(grupoTravadoId, prefixoTravado, sub.nome);
          }
          // Se já tem prefixo, mantém como está
        }
      }
    }
  }

  // Filtrar apenas itens com valor preenchido
  const itensComValor = itens.filter((item) => Number(item.valor) > 0);

  // Validar soma apenas se houver itens com valor
  if (itensComValor.length > 0) {
    const soma = itensComValor.reduce((acc, item) => acc + Number(item.valor), 0);
    const diff = Math.abs(soma - Number(pagamento.valor_bruto));
    if (diff > 0.01) {
      res.status(422).json({
        error: `Soma dos itens (${soma.toFixed(2)}) deve ser igual ao valor bruto (${Number(pagamento.valor_bruto).toFixed(2)})`,
      });
      return;
    }
  }

  // Salvar JSON com apenas itens com valor
  const pagamentoUpdate: Record<string, any> = {
    rateio_itens: itensComValor.length > 0 ? JSON.stringify(itensComValor) : null,
  };

  // Se for DEA/RP e houve rateio válido, marca o pagamento no grid com o subgrupo "DEA - RATEIO" / "RP - RATEIO"
  if (itensComValor.length > 0 && grupoTravadoId && prefixoTravado) {
    pagamentoUpdate.fk_grupo_pag = grupoTravadoId;
    pagamentoUpdate.fk_subgrupo_pag = await resolverSubgrupoPrefixado(grupoTravadoId, prefixoTravado, 'RATEIO');
  }

  await db('fact_ordem_pagamento')
    .where({ id })
    .update(pagamentoUpdate);

  // Atualizar template: gravar TODOS os grupos/subgrupos enviados (mesmo sem valor)
  // para que apareçam como sugestão na próxima vez
  if (pagamento.fk_credor && pagamento.num_empenho_base) {
    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      const fkGrupo = item.fk_grupo || null;
      const fkSubgrupo = item.fk_subgrupo || null;
      const fkSetor = pagamento.fk_setor_pag || null;

      // Ignorar itens completamente vazios
      if (!fkGrupo && !fkSubgrupo) continue;

      // Upsert no template
      await db('dim_rateio_template')
        .insert({
          fk_credor: pagamento.fk_credor,
          num_empenho_base: pagamento.num_empenho_base,
          fk_setor: fkSetor,
          fk_grupo: fkGrupo,
          fk_subgrupo: fkSubgrupo,
          ordem: i,
        })
        .onConflict(['fk_credor', 'num_empenho_base', 'fk_setor', 'fk_grupo', 'fk_subgrupo'])
        .merge({ ordem: i });
    }
  }

  res.json(itensComValor);
}

// Retorna o template de grupos/subgrupos para um credor+empenho+setor
export async function getTemplate(req: Request, res: Response): Promise<void> {
  const { credorId, empenhoBase, setorId } = req.query as Record<string, string>;

  if (!credorId || !empenhoBase) {
    res.json([]);
    return;
  }

  const rows = await db('dim_rateio_template as rt')
    .leftJoin('dim_grupo_despesa as g', 'rt.fk_grupo', 'g.id')
    .leftJoin('dim_subgrupo_despesa as s', 'rt.fk_subgrupo', 's.id')
    .where('rt.fk_credor', credorId)
    .where('rt.num_empenho_base', empenhoBase)
    .where('rt.fk_setor', setorId || null)
    .orderBy('rt.ordem')
    .select(
      'rt.fk_grupo',
      'rt.fk_subgrupo',
      'g.nome as grupo_nome',
      's.nome as subgrupo_nome',
    );

  res.json(rows);
}
