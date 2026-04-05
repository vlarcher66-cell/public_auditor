'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { apiRequest } from '@/lib/api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Municipio {
  id: number;
  nome: string;
  uf: string | null;
}

export interface Entidade {
  id: number;
  nome: string;
  tipo: 'PREFEITURA' | 'FUNDO' | 'AUTARQUIA' | string;
  fk_municipio: number;
}

interface MunicipioEntidadeContextValue {
  // Dados disponíveis
  municipios: Municipio[];
  entidades: Entidade[];

  // Selecionados
  municipioSelecionado: Municipio | null;
  entidadeSelecionada: Entidade | null;    // null = "Consolidado (todas)"

  // Setters (só disponíveis conforme o role)
  setMunicipioSelecionado: (m: Municipio) => void;
  setEntidadeSelecionada:  (e: Entidade | null) => void;

  // Permissões
  podeEscolherMunicipio: boolean;
  podeEscolherEntidade:  boolean;

  // Loading
  loading: boolean;
}

const MunicipioEntidadeContext = createContext<MunicipioEntidadeContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MunicipioEntidadeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const token    = (session as any)?.accessToken as string | undefined;
  const role     = (session?.user as any)?.role as string | undefined;
  const jwtMunId = (session?.user as any)?.fk_municipio as number | null | undefined;
  const jwtEntId = (session?.user as any)?.fk_entidade  as number | null | undefined;

  const [municipios,            setMunicipios]            = useState<Municipio[]>([]);
  const [entidades,             setEntidades]             = useState<Entidade[]>([]);
  const [municipioSelecionado,  setMunicipioSelecionadoSt] = useState<Municipio | null>(null);
  const [entidadeSelecionada,   setEntidadeSelecionadaSt]  = useState<Entidade | null>(null);
  const [loading,               setLoading]               = useState(true);

  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const podeEscolherMunicipio = isSuperAdmin;
  const podeEscolherEntidade  = isSuperAdmin || role === 'GESTOR';

  // ── Carrega municípios (só SUPER_ADMIN/ADMIN precisa da lista) ────────────
  useEffect(() => {
    if (!token || !isSuperAdmin) return;
    apiRequest<Municipio[]>('/municipios/list', { token })
      .then((rows) => setMunicipios(rows))
      .catch(() => {});
  }, [token, role]);

  // ── Carrega entidades quando município muda ───────────────────────────────
  const carregarEntidades = useCallback(async (munId: number) => {
    if (!token) return;
    try {
      const rows: Entidade[] = await apiRequest(`/entidades/list?municipioId=${munId}`, { token });
      setEntidades(rows);
      // Reseta entidade selecionada para "Consolidado"
      setEntidadeSelecionadaSt(null);
    } catch {}
  }, [token]);

  // ── Inicialização baseada no role ─────────────────────────────────────────
  useEffect(() => {
    if (!token || !role) return;

    async function init() {
      setLoading(true);
      try {
        if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
          // Carrega lista de municípios e aguarda seleção manual
          const rows: Municipio[] = await apiRequest('/municipios/list', { token });
          setMunicipios(rows);
          if (rows.length > 0) {
            setMunicipioSelecionadoSt(rows[0]);
            await carregarEntidades(rows[0].id);
          }

        } else if (role === 'GESTOR') {
          // Município fixo do JWT, entidades livres
          if (jwtMunId) {
            const list: Municipio[] = await apiRequest('/municipios/list', { token });
            const mun = list.find(m => m.id === jwtMunId) ?? null;
            if (mun) setMunicipioSelecionadoSt(mun);
            await carregarEntidades(jwtMunId);
          }

        } else {
          // CONTADOR / AUDITOR / VIEWER — tudo fixo
          if (jwtMunId) {
            const list: Municipio[] = await apiRequest('/municipios/list', { token });
            const mun = list.find(m => m.id === jwtMunId) ?? null;
            if (mun) setMunicipioSelecionadoSt(mun);
          }
          if (jwtEntId) {
            const ent: Entidade = await apiRequest(`/entidades/${jwtEntId}`, { token });
            setEntidadeSelecionadaSt(ent);
            setEntidades([ent]);
          }
        }
      } catch {}
      finally { setLoading(false); }
    }

    init();
  }, [token, role, jwtMunId, jwtEntId]); // eslint-disable-line

  // ── Troca de município (só SUPER_ADMIN) ───────────────────────────────────
  const setMunicipioSelecionado = useCallback((m: Municipio) => {
    if (!podeEscolherMunicipio) return;
    setMunicipioSelecionadoSt(m);
    carregarEntidades(m.id);
  }, [podeEscolherMunicipio, carregarEntidades]);

  // ── Troca de entidade ─────────────────────────────────────────────────────
  const setEntidadeSelecionada = useCallback((e: Entidade | null) => {
    if (!podeEscolherEntidade) return;
    setEntidadeSelecionadaSt(e);
  }, [podeEscolherEntidade]);

  return (
    <MunicipioEntidadeContext.Provider value={{
      municipios,
      entidades,
      municipioSelecionado,
      entidadeSelecionada,
      setMunicipioSelecionado,
      setEntidadeSelecionada,
      podeEscolherMunicipio,
      podeEscolherEntidade,
      loading,
    }}>
      {children}
    </MunicipioEntidadeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMunicipioEntidade() {
  const ctx = useContext(MunicipioEntidadeContext);
  if (!ctx) throw new Error('useMunicipioEntidade must be used within MunicipioEntidadeProvider');
  return ctx;
}
