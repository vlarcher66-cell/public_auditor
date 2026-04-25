'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { apiRequest } from '@/lib/api';

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
  municipios: Municipio[];
  entidades: Entidade[];
  municipioSelecionado: Municipio | null;
  entidadeSelecionada: Entidade | null;
  setMunicipioSelecionado: (m: Municipio) => void;
  setEntidadeSelecionada: (e: Entidade) => void;
  podeEscolherMunicipio: boolean;
  podeEscolherEntidade: boolean;
  loading: boolean;
}

const MunicipioEntidadeContext = createContext<MunicipioEntidadeContextValue | null>(null);

export function MunicipioEntidadeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const token     = (session as any)?.accessToken as string | undefined;
  const role      = (session?.user as any)?.role as string | undefined;
  const jwtMunId  = (session?.user as any)?.fk_municipio  as number | null | undefined;
  const jwtEntId  = (session?.user as any)?.fk_entidade   as number | null | undefined;
  const jwtEntIds = ((session?.user as any)?.entidades_ids as number[] | undefined) ?? [];

  const [municipios,           setMunicipios]           = useState<Municipio[]>([]);
  const [entidades,            setEntidades]            = useState<Entidade[]>([]);
  const [municipioSelecionado, setMunicipioSelecionadoSt] = useState<Municipio | null>(null);
  const [entidadeSelecionada,  setEntidadeSelecionadaSt]  = useState<Entidade | null>(null);
  const [loading,              setLoading]              = useState(true);

  // Guarda a chave da última init executada — evita double-fire do NextAuth (loading→authenticated)
  const initKey = useRef<string | null>(null);
  // Ref para o token sempre atualizado, usável dentro de callbacks sem re-criar o callback
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const isSuperAdmin        = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const podeEscolherMunicipio = isSuperAdmin;
  const podeEscolherEntidade  = isSuperAdmin || role === 'GESTOR';

  const carregarEntidades = useCallback(async (munId: number) => {
    const tk = tokenRef.current;
    if (!tk) return;
    try {
      const rows: Entidade[] = await apiRequest(`/entidades/list?municipioId=${munId}`, { token: tk });
      setEntidades(rows);
      setEntidadeSelecionadaSt(rows.length > 0 ? rows[0] : null);
    } catch {}
  }, []); // sem dependências — usa tokenRef internamente

  useEffect(() => {
    if (!token || !role) return;

    const key = `${token}|${role}|${jwtMunId}|${jwtEntId}`;
    if (initKey.current === key) return;
    initKey.current = key;

    async function init() {
      setLoading(true);
      try {
        if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
          const rows: Municipio[] = await apiRequest('/municipios/list', { token });
          setMunicipios(rows);
          if (rows.length > 0) {
            setMunicipioSelecionadoSt(rows[0]);
            await carregarEntidades(rows[0].id);
          }

        } else if (role === 'GESTOR') {
          if (jwtMunId) {
            const list: Municipio[] = await apiRequest('/municipios/list', { token });
            const mun = list.find(m => m.id === jwtMunId) ?? null;
            if (mun) setMunicipioSelecionadoSt(mun);
            await carregarEntidades(jwtMunId);
          }

        } else {
          // CONTADOR / AUDITOR / VIEWER
          if (jwtMunId) {
            const list: Municipio[] = await apiRequest('/municipios/list', { token });
            const mun = list.find(m => m.id === jwtMunId) ?? null;
            if (mun) setMunicipioSelecionadoSt(mun);
          }
          if (jwtEntIds.length > 0) {
            const todas: Entidade[] = await apiRequest(`/entidades/list?municipioId=${jwtMunId}`, { token });
            const permitidas = todas.filter(e => jwtEntIds.includes(e.id));
            setEntidades(permitidas);
            if (permitidas.length > 0) setEntidadeSelecionadaSt(permitidas[0]);
          } else if (jwtEntId) {
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

  const setMunicipioSelecionado = useCallback((m: Municipio) => {
    if (!podeEscolherMunicipio) return;
    setMunicipioSelecionadoSt(m);
    carregarEntidades(m.id);
  }, [podeEscolherMunicipio, carregarEntidades]);

  const setEntidadeSelecionada = useCallback((e: Entidade) => {
    if (!podeEscolherEntidade) return;
    setEntidadeSelecionadaSt(e);
  }, [podeEscolherEntidade]);

  // Memoiza o value para evitar re-renders em cascata nos consumers
  const value = useMemo<MunicipioEntidadeContextValue>(() => ({
    municipios,
    entidades,
    municipioSelecionado,
    entidadeSelecionada,
    setMunicipioSelecionado,
    setEntidadeSelecionada,
    podeEscolherMunicipio,
    podeEscolherEntidade,
    loading,
  }), [
    municipios, entidades, municipioSelecionado, entidadeSelecionada,
    setMunicipioSelecionado, setEntidadeSelecionada,
    podeEscolherMunicipio, podeEscolherEntidade, loading,
  ]);

  return (
    <MunicipioEntidadeContext.Provider value={value}>
      {children}
    </MunicipioEntidadeContext.Provider>
  );
}

export function useMunicipioEntidade() {
  const ctx = useContext(MunicipioEntidadeContext);
  if (!ctx) throw new Error('useMunicipioEntidade must be used within MunicipioEntidadeProvider');
  return ctx;
}
