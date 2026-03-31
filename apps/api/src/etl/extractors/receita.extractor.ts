import * as fs from 'fs';

export interface RawReceita {
  data_receita: string;        // dd/mm/yyyy ou yyyy-mm-dd
  conhecimento: string;
  num_empenho: string;
  codigo_rubrica: string;
  descricao: string;
  fornecedor_nome: string;
  fornecedor_doc: string;      // CNPJ/CPF como aparece no arquivo
  valor: string;               // valor BR "1.249.065,00" ou numérico como string "51.43"
  // metadados extraídos do cabeçalho
  entidade_nome: string;
  entidade_cnpj: string;
  periodo_inicio: string;      // dd/mm/yyyy
  periodo_fim: string;         // dd/mm/yyyy
  // campo extra do Excel FATOR: fonte já extraída ("1500", "1600", etc.)
  fonte_recurso_raw?: string;
}

// Linha de dados: começa com data dd/01/yyyy
const DATA_LINE_RE = /^\d{2}\/\d{2}\/\d{4}/;

export async function extractReceitaFromPdf(filePath: string): Promise<RawReceita[]> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require('pdf-parse');
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  const rawLines: string[] = data.text
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  // ── Extrai metadados do cabeçalho ─────────────────────────────────────────
  const headerText = rawLines.slice(0, 15).join(' ');
  const entidade_nome = rawLines[0]?.trim() || '';
  const cnpjMatch = headerText.match(/CNPJ[:\s]*([\d.\/\-]+)/i);
  const entidade_cnpj = cnpjMatch?.[1]?.trim() || '';
  const periodMatch = headerText.match(/([\d]{2}\/[\d]{2}\/[\d]{4})\s+a\s+([\d]{2}\/[\d]{2}\/[\d]{4})/);
  const periodo_inicio = periodMatch?.[1] || '';
  const periodo_fim = periodMatch?.[2] || '';

  // ── Parse das linhas de dados ──────────────────────────────────────────────
  // Layout do PDF SIAFIC Receita (por análise do documento):
  // Data | Conhecimento | Empenho | Código | Descrição | Fornecedor | Documento | Valor
  //
  // Cada linha começa com dd/mm/yyyy seguido dos campos concatenados.
  // Campos sem valor aparecem como espaço ou são omitidos.

  const rows: RawReceita[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Ignora linhas de cabeçalho, rodapé e totais
    if (
      !DATA_LINE_RE.test(line) ||
      /^Página:|^Sub-Total|^Total|^SIAFIC|^FUNDO MUNICIPAL|^PREFEITURA|^PRAÇA|^CNPJ:|^LISTAGEM|^Data$|^Relação/i.test(line)
    ) continue;

    // Tenta montar linha completa colando continuação
    let merged = line;
    while (i + 1 < rawLines.length) {
      const next = rawLines[i + 1];
      // Para quando encontra nova linha de dado ou marcador de seção
      if (
        DATA_LINE_RE.test(next) ||
        /^Página:|^Sub-Total|^Total|^SIAFIC|^FUNDO|^PREFEITURA|^PRAÇA|^LISTAGEM|^Relação/i.test(next)
      ) break;
      // Para em linhas muito curtas (números isolados = nº de página)
      if (/^\d{1,3}$/.test(next)) { i++; continue; }
      merged += ' ' + next;
      i++;
    }

    const parsed = parseReceitaLine(merged);
    if (parsed) {
      rows.push({
        ...parsed,
        entidade_nome,
        entidade_cnpj,
        periodo_inicio,
        periodo_fim,
      });
    }
  }

  return rows;
}

function parseReceitaLine(line: string): Omit<RawReceita, 'entidade_nome' | 'entidade_cnpj' | 'periodo_inicio' | 'periodo_fim'> | null {
  // 1. Data dd/mm/yyyy
  const dataM = line.match(/^(\d{2}\/\d{2}\/\d{4})\s*/);
  if (!dataM) return null;
  const data_receita = dataM[1];
  let rest = line.slice(dataM[0].length);

  // 2. Conhecimento (número inteiro)
  const conhecM = rest.match(/^(\d+)\s+/);
  const conhecimento = conhecM ? conhecM[1] : '';
  if (conhecM) rest = rest.slice(conhecM[0].length);

  // 3. Empenho (número, pode ter barra ex: "2088 / 4", ou ser vazio se próximo campo for código)
  const empM = rest.match(/^(\d+\s*\/\s*\d+|\d+)\s+/);
  // Só captura como empenho se não parece código orçamentário (código tem pontos separando)
  let num_empenho = '';
  if (empM && !empM[1].includes('.')) {
    num_empenho = empM[1].replace(/\s/g, '');
    rest = rest.slice(empM[0].length);
  }

  // 4. Código orçamentário: sequência de números separados por pontos (ex: 2.1.8.8.1.01.04.00.00.003)
  const codM = rest.match(/^([\d]+(?:\.[\d]+)+)\s*/);
  const codigo_rubrica = codM ? codM[1] : '';
  if (codM) rest = rest.slice(codM[0].length);

  // 5. Descrição: texto até encontrar CNPJ/CPF do fornecedor
  // Fornecedor doc pattern: xx.xxx.xxx/xxxx-xx ou xxx.xxx.xxx-xx
  const docPattern = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/;
  const docMatch = rest.match(docPattern);

  let descricao = '';
  let fornecedor_nome = '';
  let fornecedor_doc = '';
  let valor = '';

  if (docMatch && docMatch.index !== undefined) {
    // Texto antes do CNPJ = descrição + nome do fornecedor concatenados
    // O fornecedor geralmente vem depois da descrição, separado por espaço
    // Estratégia: pega tudo antes do CNPJ, depois tenta separar descrição de fornecedor
    const beforeDoc = rest.slice(0, docMatch.index).trim();
    fornecedor_doc = docMatch[1];
    const afterDoc = rest.slice(docMatch.index + docMatch[1].length).trim();

    // Valor: último token numérico BR (ex: "1.249.065,00")
    const valorM = afterDoc.match(/([\d.]+,\d{2})\s*$/);
    valor = valorM ? valorM[1] : '';

    // Tenta separar descrição de fornecedor pelo padrão:
    // descrição geralmente são palavras com hífen/traço e fonte (ex: "IRRF - Fonte 1500")
    // fornecedor tem palavras em maiúsculas e pode ser longo
    // Heurística: encontra a primeira palavra toda maiúscula que não faz parte de siglas conhecidas
    const parts = beforeDoc.split(/\s{2,}/); // separa por 2+ espaços
    if (parts.length >= 2) {
      descricao = parts[0].trim();
      fornecedor_nome = parts.slice(1).join(' ').trim();
    } else {
      // Tenta pelo padrão "descrição FORNECEDOR" onde fornecedor começa com palavra >= 4 letras maiúsculas
      const splitM = beforeDoc.match(/^(.+?)\s{1,}([A-ZÁÉÍÓÚÃÕÇ]{3,}.*)$/);
      if (splitM) {
        descricao = splitM[1].trim();
        fornecedor_nome = splitM[2].trim();
      } else {
        descricao = beforeDoc;
        fornecedor_nome = '';
      }
    }
  } else {
    // Sem CNPJ identificado — pega o que der
    descricao = rest.trim();
    // Tenta extrair valor do final
    const valorM = rest.match(/([\d.]+,\d{2})\s*$/);
    valor = valorM ? valorM[1] : '0,00';
  }

  if (!valor) return null;

  return {
    data_receita,
    conhecimento,
    num_empenho,
    codigo_rubrica,
    descricao: descricao.trim(),
    fornecedor_nome: fornecedor_nome.trim(),
    fornecedor_doc: fornecedor_doc.trim(),
    valor,
  };
}
