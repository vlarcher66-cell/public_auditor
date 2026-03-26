export type ImportJobStatus =
  | 'QUEUED'
  | 'EXTRACTING'
  | 'TRANSFORMING'
  | 'LOADING'
  | 'DONE'
  | 'ERROR';

export type ImportFileType = 'PDF' | 'XLSX' | 'CSV';

export type TipoRelatorio = 'OR' | 'RP';

export interface ImportJob {
  id: number;
  uuid: string;
  filename: string;
  file_type: ImportFileType;
  file_size_bytes: number | null;
  status: ImportJobStatus;
  tipo_relatorio: TipoRelatorio;
  total_rows: number;
  rows_loaded: number;
  rows_skipped: number;
  rows_errored: number;
  valor_bruto_total: number;
  error_log: ImportErrorEntry[] | null;
  started_at: string | null;
  finished_at: string | null;
  criado_em: string;
}

export interface ImportErrorEntry {
  row_index: number;
  field: string;
  message: string;
  raw_value: string;
}
