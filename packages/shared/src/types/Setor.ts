export interface Bloco {
  id: number;
  descricao: string;
  criado_em?: string;
}

export interface Setor {
  id: number;
  descricao: string;
  fk_bloco: number;
  palavras_chave?: string | null;
  bloco_id?: number;
  bloco_descricao?: string;
  criado_em?: string;
}
