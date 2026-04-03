'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronLeft, ChevronRight, Check, X, AlertCircle, Loader2, Search } from 'lucide-react';
import TopBar from '@/components/dashboard/TopBar';
import { SearchSelect } from '@/components/SearchSelect';
import { apiRequest } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Subgrupo {
  id: number;
  nome: string;
  fk_grupo: number;
}

interface SugestaoClassificacao {
  fk_grupo: number | null;
  fk_subgrupo: number | null;
  grupo_nome: string | null;
  subgrupo_nome: string | null;
  confianca: 'alta' | 'media' | 'baixa' | 'nenhuma';
  motivo: string;
  palavrasEncontradas: string[];
}

interface CredorParaConfirmar {
  id: number;
  nome: string;
  historico: string | null;
  fk_grupo: number;
  grupo_nome: string;
  sugestao: SugestaoClassificacao;
}

export default function ConfirmacaoDiariasPage() {
  const { data: session } = useSession();
  const [credores, setCredores] = useState<CredorParaConfirmar[]>([]);
  const [subgrupos, setSubgrupos] = useState<Subgrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const token = (session?.user as any)?.token as string;

  useEffect(() => {
    if (!token) return;
    carregarDados();
  }, [token, page]);

  async function carregarDados() {
    try {
      setLoading(true);
      const [credoresResp, subgruposResp] = await Promise.all([
        fetch(`${API_URL}/api/credores/confirmar-diarias/listar?page=${page}&limit=${limit}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : { rows: [], total: 0 })),
        fetch(`${API_URL}/api/credores/subgrupos`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : [])),
      ]);

      setCredores(credoresResp.rows || []);
      setTotal(credoresResp.total || 0);
      setSubgrupos(subgruposResp || []);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }

  async function confirmarClassificacao(credorId: number, fk_subgrupo: number) {
    try {
      setConfirmando(credorId);
      const res = await fetch(`${API_URL}/api/credores/${credorId}/confirmar-classificacao-diaria`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fk_subgrupo }),
      });

      if (res.ok) {
        setCredores((prev) => prev.filter((c) => c.id !== credorId));
        setTotal((prev) => prev - 1);
      }
    } catch (err) {
      console.error('Erro ao confirmar:', err);
    } finally {
      setConfirmando(null);
    }
  }

  function getNivelConfiancaClass(confianca: string) {
    switch (confianca) {
      case 'alta':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'media':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'baixa':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  }

  function getNivelConfiancaBadge(confianca: string) {
    switch (confianca) {
      case 'alta':
        return '🟢';
      case 'media':
        return '🟡';
      case 'baixa':
        return '🔴';
      default:
        return '⚫';
    }
  }

  if (loading && credores.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin mr-2" size={24} />
        Carregando...
      </div>
    );
  }

  if (credores.length === 0 && !loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <TopBar title="Confirmação de Diárias" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Check size={48} className="mx-auto text-green-600 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Tudo Confirmado!</h2>
            <p className="text-gray-600">Todos os credores de diárias já foram classificados.</p>
          </div>
        </div>
      </div>
    );
  }

  const paginaAtual = Math.ceil(credores.length / limit) || 1;
  const totalPaginas = Math.ceil(total / limit);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <TopBar title="Confirmação de Diárias" />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Confirmação de Diárias</h1>
          <p className="text-sm text-gray-600 mt-1">
            {total} credores aguardando classificação de subgrupo
          </p>
        </div>

        {/* Cards dos credores */}
        <div className="grid gap-4">
          {credores.map((credor) => {
            const sugestao = credor.sugestao;
            const subgruposDisponiveis = subgrupos.filter(
              (s) => s.fk_grupo === sugestao.fk_grupo && s.nome.toUpperCase().includes('DIÁRIA')
            );

            return (
              <div
                key={credor.id}
                className={cn(
                  'bg-white rounded-xl border-2 p-6 transition-all',
                  getNivelConfiancaClass(sugestao.confianca)
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{credor.nome}</h3>
                      <span className="text-2xl">
                        {getNivelConfiancaBadge(sugestao.confianca)}
                      </span>
                    </div>
                    {credor.historico && (
                      <p className="text-sm text-gray-600 italic line-clamp-2">{credor.historico}</p>
                    )}
                  </div>
                </div>

                {/* Sugestão */}
                <div className="bg-white bg-opacity-60 rounded-lg p-4 mb-4 border border-current border-opacity-20">
                  <p className="text-xs font-medium text-gray-600 mb-2">SUGESTÃO DO SISTEMA:</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-600">Grupo:</p>
                      <p className="font-semibold text-gray-900">{sugestao.grupo_nome}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Subgrupo Sugerido:</p>
                      <p className="font-semibold text-gray-900">{sugestao.subgrupo_nome}</p>
                    </div>
                    {sugestao.palavrasEncontradas.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-600">Palavras encontradas:</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {sugestao.palavrasEncontradas.map((palavra) => (
                            <span
                              key={palavra}
                              className="px-2 py-1 text-xs rounded-full bg-current bg-opacity-10 font-medium"
                            >
                              {palavra}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-600 mt-2">{sugestao.motivo}</p>
                  </div>
                </div>

                {/* Controles */}
                <div className="flex gap-3">
                  {sugestao.fk_subgrupo ? (
                    <button
                      onClick={() => confirmarClassificacao(credor.id, sugestao.fk_subgrupo!)}
                      disabled={confirmando === credor.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
                    >
                      {confirmando === credor.id ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Confirmando...
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          Confirmar Sugestão
                        </>
                      )}
                    </button>
                  ) : null}

                  {!sugestao.fk_subgrupo && (
                    <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-gray-600">
                      <AlertCircle size={16} />
                      <span className="text-sm">Nenhuma correspondência encontrada</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Paginação */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} /> Anterior
            </button>

            <span className="text-sm text-gray-600">
              Página {page} de {totalPaginas}
            </span>

            <button
              onClick={() => setPage(Math.min(totalPaginas, page + 1))}
              disabled={page === totalPaginas}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
