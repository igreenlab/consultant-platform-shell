import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { voSession } from './session-storage';
import { decodeVoJwt, idconsultorFromToken, isTokenExpired } from './jwt';
import type { Consultant, SessionValue } from './types';

/**
 * ★ O Context de sessão ÚNICO da plataforma.
 *
 * Este objeto `createContext(...)` é a peça central do pacote: como
 * `@igreen/platform-shell` é `shared: { singleton: true }` no Module Federation
 * (ver `federationShared` + spike-federation.md §4), host e remotes resolvem
 * ESTE MESMO objeto. Assim o valor provido pelo host é lido por `useSession()`
 * dentro de um remote. Se o pacote NÃO for singleton, cada lado cria seu próprio
 * Context e o remote lê `null` → falha silenciosa de sessão.
 *
 * Evolui `ui/src/auth/SessionProvider.tsx` do VO, mas desacoplado do
 * react-router (o host é dono do history) e do axios privado do VO (o fetcher do
 * consultor é injetável).
 */
const SessionContext = createContext<SessionValue | null>(null);

/** Query key canônica do consultor — a MESMA do VO (`['consultant', token]`). */
export function consultantQueryKey(token: string | null) {
  return ['consultant', token] as const;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/**
 * `apiBase` só pode RESOLVER pra mesma origem do host. Um `apiBase` apontando
 * pra fora vazaria o Bearer token do consultor na primeira chamada.
 *
 * Começar com `/` não prova nada: `//evil.com` e `/\evil.com` também começam
 * com barra e resolvem pra outra origem (URL protocol-relative — o segundo
 * porque o parser WHATWG trata `\` como `/` em esquemas especiais). Por isso a
 * checagem resolve SEMPRE contra a origem da página, sem atalho por prefixo.
 */
function assertSameOriginApiBase(apiBase: string) {
  if (!apiBase) return; // vazio: fetch relativo à própria página
  const origin = typeof window === 'undefined' ? null : window.location?.origin;
  if (!origin) return; // SSR/teste: sem origem pra comparar

  let resolved: URL;
  try {
    resolved = new URL(apiBase, origin);
  } catch {
    return; // URL inválida: deixa o fetch falhar com o erro real
  }

  if (resolved.origin !== origin) {
    throw new Error(
      `SessionProvider: apiBase="${apiBase}" resolve pra outra origem (${resolved.origin}) — ` +
        'o Bearer token do consultor não pode sair do host. Use um path relativo.',
    );
  }
}

/**
 * Fetcher default: `GET {apiBase}/v1/consultant` com Bearer, desembrulhando o
 * envelope da API do VO (`{ success, data }`). O host pode injetar seu próprio
 * `fetchConsultant` (ex.: o `api` client do VO) via prop.
 */
function makeDefaultFetchConsultant(apiBase: string) {
  assertSameOriginApiBase(apiBase);
  return async function defaultFetchConsultant(token: string): Promise<Consultant> {
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/v1/consultant`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body: unknown = await res.json().catch(() => null);
    if (body && typeof body === 'object' && 'success' in body) {
      const env = body as ApiEnvelope<Consultant>;
      if (env.success && env.data) return env.data;
      throw new Error(env.error?.message ?? 'Falha ao carregar consultor.');
    }
    if (!res.ok) throw new Error(`GET /v1/consultant → HTTP ${res.status}`);
    return body as Consultant;
  };
}

export interface SessionProviderProps {
  children: ReactNode;
  /**
   * Como carregar o perfil do consultor a partir do token. Default: fetch a
   * `${apiBase}/v1/consultant` desembrulhando o envelope do VO.
   */
  fetchConsultant?: (token: string) => Promise<Consultant>;
  /** Base da API do VO usada pelo fetcher default. Ignorado se `fetchConsultant`. */
  apiBase?: string;
  /** Chamado após `logout()` limpar a sessão — o host navega (ex.: `/login`). */
  onLogout?: () => void;
}

export function SessionProvider({
  children,
  fetchConsultant,
  apiBase = '',
  onLogout,
}: SessionProviderProps) {
  const queryClient = useQueryClient();

  // Espelha a voSession e reage ao `subscribe` (inclusive troca em outra aba).
  const [token, setTokenState] = useState<string | null>(() =>
    voSession.getToken(),
  );

  useEffect(() => {
    return voSession.subscribe(() => setTokenState(voSession.getToken()));
  }, []);

  // Identidade α: `idconsultor` sai do `sub` do JWT, síncrono (sem esperar o fetch).
  const idconsultor = useMemo(() => idconsultorFromToken(token), [token]);

  const loadConsultant = useMemo(
    () => fetchConsultant ?? makeDefaultFetchConsultant(apiBase),
    [fetchConsultant, apiBase],
  );

  // ÚNICO ponto que busca o consultor (evita o duplo-fetch do legado).
  const { data: consultant, isLoading } = useQuery({
    queryKey: consultantQueryKey(token),
    queryFn: () => loadConsultant(token as string),
    enabled: !!token && !isTokenExpired(token),
  });

  const login = useCallback(
    (newToken: string, opts?: { keepConnected?: boolean }) => {
      voSession.setToken(newToken, opts);
      setTokenState(newToken);
    },
    [],
  );

  const logout = useCallback(() => {
    voSession.clear();
    setTokenState(null);
    queryClient.clear();
    onLogout?.();
  }, [queryClient, onLogout]);

  // isTokenExpired() existia mas não era usado — sessão morta (token com
  // `exp` no passado) ficava restaurada silenciosamente até a primeira
  // chamada de API falhar. Desloga assim que o token (restaurado do storage ou
  // trocado noutra aba) já está expirado, E agenda o logout pro instante do
  // `exp`: só a checagem no mount deixaria uma aba aberta seguir com a sessão
  // de pé depois de expirar, já que nada re-renderiza sozinho.
  useEffect(() => {
    if (!token) return;
    if (isTokenExpired(token)) {
      logout();
      return;
    }
    const exp = decodeVoJwt(token)?.exp;
    if (typeof exp !== 'number') return; // sem `exp` legível: quem decide é o backend

    const ms = exp * 1000 - Date.now();
    // setTimeout satura acima de 2^31-1 ms e dispararia NA HORA — token com
    // validade tão longa fica sem timer (a checagem acima já cobre o mount).
    if (ms <= 0 || ms > 2_147_483_647) return;

    const timer = setTimeout(logout, ms);
    return () => clearTimeout(timer);
  }, [token, logout]);

  const value = useMemo<SessionValue>(
    () => ({
      token,
      idconsultor,
      consultant: consultant ?? null,
      isLoading: !!token && isLoading,
      login,
      logout,
    }),
    [token, idconsultor, consultant, isLoading, login, logout],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/**
 * Lê a sessão única. Funciona no host E dentro de um remote federado —
 * desde que `@igreen/platform-shell` seja `shared: { singleton: true }`.
 */
export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error(
      'useSession() deve ser usado dentro de <SessionProvider>. ' +
        'Num remote federado, isto normalmente indica que @igreen/platform-shell ' +
        'NÃO está como shared singleton no Module Federation.',
    );
  }
  return ctx;
}

/** Variante que não lança fora do provider (útil em componentes standalone). */
export function useSessionOptional(): SessionValue | null {
  return useContext(SessionContext);
}
