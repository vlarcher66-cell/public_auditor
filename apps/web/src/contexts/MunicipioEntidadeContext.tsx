'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  entidadeSelecionada: Entidade | null;    // null = nenhuma entidade carregada ainda

  // Setters (só disponíveis conforme o role)
  setMunicipioSelecionado: (m: Municipio) => void;
  setEntidadeSelecionada:  (e: Entidade) => void;  // sempre requer entidade — sem consolidado

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
  const token         = (session as any)?.accessToken as string | undefined;
  const role          = (session?.user as any)?.role as string | undefined;
  const jwtMunId      = (session?.user as any)?.fk_municipio  as number | null | undefined;
  const jwtEntId      = (session?.user as any)?.fk_entidade   as number | null | undefined;
  const jwtEntIds     = (session?.user as any)?.entidades_ids as number[] | undefined ?? [];

  const [municipios,            setMunicipios]            = useState<Municipio[]>([]);
  const [entidades,             setEntidades]             = useState<Entidade[]>([]);
  const [municipioSelecionado,  setMunicipioSelecionadoSt] = useState<Municipio | null>(null);
  const [entidadeSelecionada,   setEntidadeSelecionadaSt]  = useState<Entidade | null>(null);
  const [loading,               setLoading]               = useState(true);
  const initKey = useRef<string | null>(null);

  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const podeEscolherMunicipio = isSuperAdmin;
  const podeEscolherEntidade  = isSuperAdmin || role === 'GESTOR';

  // ── Carrega entidades quando município muda ───────────────────────────────
  const carregarEntidades = useCallback(async (munId: number) => {
    if (!token) return;
    try {
      const rows: Entidade[] = await apiRequest(`/entidades/list?municipioId=${munId}`, { token });
      setEntidades(rows);
      // Sempre seleciona a primeira entidade — dados nunca são consolidados
      setEntidadeSelecionadaSt(rows.length > 0 ? rows[0] : null);
    } catch {}
  }, [token]);

  // ── Inicialização baseada no role ─────────────────────────────────────────
  useEffect(() => {
    if (!token || !role) return;

    // Evita duplo disparo quando a sessão NextAuth passa por loading→authenticated
    const key = `${token}|${role}|${jwtMunId}|${jwtEntId}`;
    if (initKey.current === key) return;
    initKey.current = key;

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
          // Município fixo do JWT, entidades livres — auto-seleciona a primeira
          if (jwtMunId) {
            const list: Municipio[] = await apiRequest('/municipios/list', { token });
            const mun = list.find(m => m.id === jwtMunId) ?? null;
            if (mun) setMunicipioSelecionadoSt(mun);
            await carregarEntidades(jwtMunId); // já auto-seleciona a primeira entidade
          }

        } else {
          // CONTADOR / AUDITOR / VIEWER — município e entidade(s) fixos
          if (jwtMunId) {
            const list: Municipio[] = await apiRequest('/municipios/list', { token });
            const mun = list.find(m => m.id === jwtMunId) ?? null;
            if (mun) setMunicipioSelecionadoSt(mun);
          }

          // Carrega as entidades acessíveis ao usuário
          if (jwtEntIds.length > 0) {
            // Tem entidades específicas vinculadas — carrega só essas
            const todas: Entidade[] = await apiRequest(`/entidades/list?municipioId=${jwtMunId}`, { token });
            const permitidas = todas.filter(e => jwtEntIds.includes(e.id));
            setEntidades(permitidas);
            // Sempre seleciona a primeira — dados nunca são consolidados
            if (permitidas.length > 0) {
              setEntidadeSelecionadaSt(permitidas[0]);
            }
          } else if (jwtEntId) {
            // Fallback: entidade única no campo fk_entidade
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
  const setEntidadeSelecionada = useCallback((e: Entidade) => {
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
