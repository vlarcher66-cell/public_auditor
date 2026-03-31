import { Knex } from 'knex';
import { createHash } from 'crypto';
import type { TransformedOrdemPagamento } from '../transformers/ordemPagamento.transformer';
import { logger } from '../../config/logger';

function hashHistorico(historico: string | null | undefined): string {
  if (!historico?.trim()) return '';
  return createHash('md5').update(historico.trim()).digest('hex');
}

const CHUNK_SIZE = 200;

export interface LoadResult {
  rows_loaded: number;
  rows_skipped: number;
}

export async function loadToMySQL(
  db: Knex,
  rows: TransformedOrdemPagamento[],
  importJobId: number,
  tipoRelatorio: string = 'OR',
  forcedEntidadeId?: number,
): Promise<LoadResult> {
  let rows_loaded = 0;
  let rows_skipped = 0;

  // Upsert helpers for SQLite (INSERT OR IGNORE)
  const upsertStr = async (table: string, col: string, values: string[]) => {
    for (const val of values) {
      if (!val) continue;
      const exists = await db(table).where(col, val).first();
      if (!exists) await db(table).insert({ [col]: val });
    }
  };

  const upsertNum = async (table: string, col: string, values: number[]) => {
    for (const val of values) {
      if (!val) continue;
      const exists = await db(table).where(col, val).first();
      if (!exists) await db(table).insert({ [col]: val });
    }
  };

  // 1. dim_entidade — se uma entidade foi selecionada na importação, usa ela diretamente.
  //    Caso contrário, tenta resolver pelo CNPJ extraído do arquivo (comportamento legado).
  const PLACEHOLDER_CNPJ = '00.000.000/0000-00';
  let resolvedEntidadeRow: { id: number; cnpj: string; fk_municipio?: number | null } | null = null;

  if (forcedEntidadeId) {
    resolvedEntidadeRow = await db('dim_entidade').where('id', forcedEntidadeId).first() || null;
  }

  if (!resolvedEntidadeRow) {
    // Fallback: cria/localiza entidade pelo CNPJ do arquivo (comportamento original)
    const entidades = uniqueBy(rows, (r) => r.entidade_cnpj_norm || PLACEHOLDER_CNPJ);
    for (const r of entidades) {
      const cnpj = r.entidade_cnpj || PLACEHOLDER_CNPJ;
      const nome = r.entidade_nome || 'Entidade não identificada';
      const exists = await db('dim_entidade').where('cnpj', cnpj).first();
      if (!exists) await db('dim_entidade').insert({ nome, cnpj, tipo: 'FUNDO' });
    }
  }

  // 2. dim_credor — unique per cnpj_cpf_norm + nome (credor distinto por CNPJ+nome)
  const credores = uniqueBy(rows, (r) => `${r.cnpj_cpf_norm}||${r.credor_nome.trim().toUpperCase()}`);
  for (const r of credores) {
    const exists = await db('dim_credor')
      .where('cnpj_cpf_norm', r.cnpj_cpf_norm)
      .whereRaw('UPPER(nome) = ?', [r.credor_nome.trim().toUpperCase()])
      .first();
    if (!exists) {
      await db('dim_credor').insert({
        nome: r.credor_nome.trim(),
        cnpj_cpf: r.cnpj_cpf,
        tipo_doc: r.tipo_doc,
        cnpj_cpf_norm: r.cnpj_cpf_norm,
        historico: r.historico || null,
        historico_hash: hashHistorico(r.historico),
        precisa_reclassificacao: false,
      });
    }
  }

  // 3. dim_tipo_empenho
  await upsertStr('dim_tipo_empenho', 'descricao', [...new Set(rows.map((r) => r.tipo_empenho))]);

  // 4. dim_periodo
  const periodos = uniqueBy(rows, (r) => toDateStr(r.periodo_inicio) + '_' + toDateStr(r.periodo_fim));
  for (const r of periodos) {
    const di = toDateStr(r.periodo_inicio);
    const df = toDateStr(r.periodo_fim);
    const exists = await db('dim_periodo').where({ data_inicio: di, data_fim: df }).first();
    if (!exists) await db('dim_periodo').insert({ data_inicio: di, data_fim: df, ano: r.periodo_inicio.getFullYear(), mes: r.periodo_inicio.getMonth() + 1 });
  }

  // 5-9. other dimensions
  await upsertNum('dim_unidade_orcamentaria', 'codigo', [...new Set(rows.map((r) => r.unidade_orcamentaria))]);
  await upsertNum('dim_unidade_gestora', 'codigo', [...new Set(rows.map((r) => r.unidade_gestora))]);
  await upsertStr('dim_acao', 'codigo', [...new Set(rows.map((r) => r.acao))]);
  await upsertStr('dim_elemento_despesa', 'codigo', [...new Set(rows.map((r) => r.elemento_despesa))]);
  await upsertStr('dim_fonte_recurso', 'codigo', [...new Set(rows.map((r) => r.fonte_recurso))]);

  // Resolve IDs dos grupos protegidos (DEA e RP) para auto-classificação por pagamento
  const grupoDeaRow = await db('dim_grupo_despesa')
    .whereRaw("UPPER(nome) LIKE '%EXERC%CIO ANTERIOR%'")
    .select('id').first();
  const grupoRpRow = await db('dim_grupo_despesa')
    .whereRaw("UPPER(nome) LIKE '%RESTOS A PAGAR%'")
    .select('id').first();
  const grupoDeaId: number | null = grupoDeaRow?.id ?? null;
  const grupoRpId: number | null = grupoRpRow?.id ?? null;

  // Mapa: grupoId_subgrupoNome → subgrupo prefixado id (cache para DEA/RP)
  const subgrupoPrefixadoCache = new Map<string, number>();
  async function resolverSubgrupoPrefixadoLoader(grupoId: number, prefixo: string, subgrupoNome: string): Promise<number | null> {
    const nomeComPrefixo = `${prefixo} - ${subgrupoNome}`;
    const cacheKey = `${grupoId}_${nomeComPrefixo}`;
    if (subgrupoPrefixadoCache.has(cacheKey)) return subgrupoPrefixadoCache.get(cacheKey)!;
    let sub = await db('dim_subgrupo_despesa').where({ nome: nomeComPrefixo, fk_grupo: grupoId }).first();
    if (!sub) {
      const [novoId] = await db('dim_subgrupo_despesa').insert({ nome: nomeComPrefixo, fk_grupo: grupoId });
      sub = { id: novoId };
    }
    subgrupoPrefixadoCache.set(cacheKey, sub.id);
    return sub.id;
  }

  // Load dimension maps
  const credorRows = await db('dim_credor as c')
    .leftJoin('dim_subgrupo_despesa as s', 'c.fk_subgrupo', 's.id')
    .select('c.id', 'c.cnpj_cpf_norm', 'c.nome', 'c.detalhar_no_pagamento', 'c.fk_subgrupo', 's.nome as subgrupo_nome');
  const credorMap = new Map<string, number>(
    credorRows.map((r: any) => [`${r.cnpj_cpf_norm}||${(r.nome as string).trim().toUpperCase()}`, r.id]),
  );

  const [entidadeMap, tipoMap, periodoMap, unidOrcMap, unidGestMap, acaoMap, elemMap, fonteMap] =
    await Promise.all([
      buildMap(db, 'dim_entidade', 'cnpj', 'id'),
      buildMap(db, 'dim_tipo_empenho', 'descricao', 'id'),
      buildPeriodoMap(db),
      buildMap(db, 'dim_unidade_orcamentaria', 'codigo', 'id'),
      buildMap(db, 'dim_unidade_gestora', 'codigo', 'id'),
      buildMap(db, 'dim_acao', 'codigo', 'id'),
      buildMap(db, 'dim_elemento_despesa', 'codigo', 'id'),
      buildMap(db, 'dim_fonte_recurso', 'codigo', 'id'),
    ]);

  // Get existing hashes for dedup
  const existingHashes = new Set<string>(
    (await db('fact_ordem_pagamento').select('hash_linha')).map((r: any) => r.hash_linha),
  );

  // Carrega regras de classificação por empenho (credor + empenho_base → grupo/subgrupo)
  const regrasEmpenho = await db('dim_classificacao_empenho')
    .select('fk_credor', 'num_empenho_base', 'fk_grupo_pag', 'fk_subgrupo_pag');
  const regraEmpenhoMap = new Map<string, { fk_grupo_pag: number | null; fk_subgrupo_pag: number | null }>(
    regrasEmpenho.map((r: any) => [`${r.fk_credor}_${r.num_empenho_base}`, { fk_grupo_pag: r.fk_grupo_pag, fk_subgrupo_pag: r.fk_subgrupo_pag }]),
  );

  // Insert fact rows in chunks
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    for (const r of chunk) {
      if (existingHashes.has(r.hash_linha)) {
        // Back-fill historico if existing row has it empty and we now have a value
        if (r.historico) {
          await db('fact_ordem_pagamento')
            .where('hash_linha', r.hash_linha)
            .where((q) => q.whereNull('historico').orWhere('historico', ''))
            .update({ historico: r.historico });
        }
        rows_skipped++;
        continue;
      }

      // Se a entidade foi selecionada pelo usuário, usa ela; senão resolve pelo CNPJ do arquivo
      const fkEntidade = resolvedEntidadeRow
        ? resolvedEntidadeRow.id
        : entidadeMap.get(r.entidade_cnpj || PLACEHOLDER_CNPJ);
      const fkMunicipio = resolvedEntidadeRow?.fk_municipio ?? null;
      const fkCredor = credorMap.get(`${r.cnpj_cpf_norm}||${r.credor_nome.trim().toUpperCase()}`);
      const fkTipo = tipoMap.get(r.tipo_empenho);
      const fkPeriodo = periodoMap.get(toDateStr(r.periodo_inicio) + '_' + toDateStr(r.periodo_fim));
      const fkUniOrc = unidOrcMap.get(String(r.unidade_orcamentaria));
      const fkUniGest = unidGestMap.get(String(r.unidade_gestora));
      const fkAcao = acaoMap.get(r.acao);
      const fkElem = elemMap.get(r.elemento_despesa);
      const fkFonte = fonteMap.get(r.fonte_recurso);

      if (!fkEntidade || !fkCredor || !fkTipo || !fkPeriodo || !fkUniOrc || !fkUniGest || !fkAcao || !fkElem || !fkFonte) {
        logger.warn({ empenho: r.num_empenho }, 'FK lookup failed, skipping');
        rows_skipped++;
        continue;
      }

      try {
        // Determine tipo_relatorio per row:
        // If elemento_despesa is 3.3.90.92.00, it's DEA (Despesa do Exercício Anterior)
        // Otherwise, use the tipo_relatorio selected by the user (OR or RP)
        const tipoRow = r.elemento_despesa === '3.3.90.92.00' ? 'DEA' : tipoRelatorio;

        // Auto-classifica grupo por pagamento conforme tipo_relatorio
        let fkGrupoPag: number | null = null;
        let fkSubgrupoPag: number | null = null;
        if (tipoRow === 'DEA' && grupoDeaId) fkGrupoPag = grupoDeaId;
        else if (tipoRow === 'RP' && grupoRpId) fkGrupoPag = grupoRpId;

        // Aplica regra de empenho se o credor usa detalhar_no_pagamento e há regra cadastrada
        const credorRow = credorRows.find((c: any) => c.id === fkCredor) as any;

        // Para DEA/RP: resolve subgrupo prefixado a partir do subgrupo do credor
        if (fkGrupoPag && credorRow?.subgrupo_nome) {
          const prefixo = fkGrupoPag === grupoDeaId ? 'DEA' : 'RP';
          fkSubgrupoPag = await resolverSubgrupoPrefixadoLoader(fkGrupoPag, prefixo, credorRow.subgrupo_nome);
        }
        if (credorRow?.detalhar_no_pagamento && r.num_empenho_base) {
          const regraKey = `${fkCredor}_${r.num_empenho_base}`;
          const regra = regraEmpenhoMap.get(regraKey);
          if (regra) {
            fkGrupoPag = regra.fk_grupo_pag;
            fkSubgrupoPag = regra.fk_subgrupo_pag;
          }
        }

        await db('fact_ordem_pagamento').insert({
          num_empenho: r.num_empenho,
          num_empenho_base: r.num_empenho_base || null,
          reduzido: r.reduzido,
          num_processo: r.num_processo || null,
          historico: r.historico || null,
          credor_nome: r.credor_nome || null,
          credor_cnpj_cpf: r.cnpj_cpf || null,
          sub_elemento: r.sub_elemento || null,
          data_pagamento: toDateStr(r.data_pagamento),
          data_empenho: r.data_empenho ? toDateStr(r.data_empenho) : null,
          data_liquidacao: r.data_liquidacao ? toDateStr(r.data_liquidacao) : null,
          valor_bruto: r.valor_bruto,
          valor_retido: r.valor_retido,
          valor_liquido: r.valor_liquido,
          valor_pessoal: r.valor_pessoal,
          tipo_relatorio: tipoRow,
          fk_grupo_pag: fkGrupoPag,
          fk_subgrupo_pag: fkSubgrupoPag,
          fk_municipio: fkMunicipio,
          fk_entidade: fkEntidade,
          fk_credor: fkCredor,
          fk_tipo_empenho: fkTipo,
          fk_periodo: fkPeriodo,
          fk_unidade_orc: fkUniOrc,
          fk_unidade_gestora: fkUniGest,
          fk_acao: fkAcao,
          fk_elemento_despesa: fkElem,
          fk_fonte_recurso: fkFonte,
          fk_import_job: importJobId,
          hash_linha: r.hash_linha,
          criado_em: new Date().toISOString(),
        });
        existingHashes.add(r.hash_linha);
        rows_loaded++;
      } catch (err: any) {
        if (err.message?.includes('UNIQUE')) {
          rows_skipped++;
        } else {
          logger.error({ err: err.message }, 'Insert error');
          rows_skipped++;
        }
      }
    }
  }

  return { rows_loaded, rows_skipped };
}

function uniqueBy<T>(arr: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function buildMap(db: Knex, table: string, keyCol: string, valCol: string): Promise<Map<string, number>> {
  const rows = await db(table).select(keyCol, valCol);
  return new Map(rows.map((r: any) => [String(r[keyCol]), r[valCol]]));
}

async function buildPeriodoMap(db: Knex): Promise<Map<string, number>> {
  const rows = await db('dim_periodo').select('id', 'data_inicio', 'data_fim');
  return new Map(rows.map((r: any) => [`${toDateStr(r.data_inicio)}_${toDateStr(r.data_fim)}`, r.id]));
}

function toDateStr(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}
