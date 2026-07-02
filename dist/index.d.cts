import * as react from 'react';
import { ReactNode } from 'react';

/** Perfil do consultor logado — espelha `GET /v1/consultant` do VO. */
interface Consultant {
    idconsultor: number;
    nome: string;
    email: string;
    cpf: string;
    cnpj: string;
    graduacao: string;
}
/** Valor exposto por `useSession()` — lido por host E remotes (via singleton). */
interface SessionValue {
    /** VO session token cru (`vo_session_token`). Bearer para as APIs. */
    token: string | null;
    /** `idconsultor` decodificado do `sub` do VO JWT (decisão α), síncrono. */
    idconsultor: number | null;
    /** Perfil carregado da API (`['consultant', token]`); `null` enquanto carrega. */
    consultant: Consultant | null;
    /** `true` enquanto o perfil do consultor está sendo buscado. */
    isLoading: boolean;
    /** Grava o token e dispara o fetch do consultor. */
    login: (token: string, opts?: {
        keepConnected?: boolean;
    }) => void;
    /** Limpa a sessão. O host decide para onde navegar via `onLogout`. */
    logout: () => void;
}

/** Query key canônica do consultor — a MESMA do VO (`['consultant', token]`). */
declare function consultantQueryKey(token: string | null): readonly ["consultant", string | null];
interface SessionProviderProps {
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
declare function SessionProvider({ children, fetchConsultant, apiBase, onLogout, }: SessionProviderProps): react.JSX.Element;
/**
 * Lê a sessão única. Funciona no host E dentro de um remote federado —
 * desde que `@igreen/platform-shell` seja `shared: { singleton: true }`.
 */
declare function useSession(): SessionValue;
/** Variante que não lança fora do provider (útil em componentes standalone). */
declare function useSessionOptional(): SessionValue | null;

/**
 * Armazenamento do token de sessão do Virtual Office.
 *
 * Porte fiel de `ui/src/auth/voSession.ts` do host VO — mesma chave
 * (`vo_session_token`), mesma política de storage e o mesmo `subscribe`.
 * Vive DENTRO deste pacote (e não no app) porque `@igreen/platform-shell` é o
 * `shared: { singleton: true }` do Module Federation: host e remotes leem a
 * MESMA sessão a partir daqui, sem cada módulo reimplementar storage.
 *
 * - "manter conectado" => localStorage (persiste entre abas/sessões)
 * - caso contrário      => sessionStorage (some ao fechar a aba)
 *
 * Sem cookies. Um único `subscribe` notifica mudanças (inclusive entre abas via
 * o evento `storage`). Todos os acessos a Web Storage / window são guardados
 * para o pacote também rodar em ambiente sem DOM (SSR / teste em node).
 */
declare const TOKEN_KEY = "vo_session_token";
type Listener = () => void;
/** Lê o token: prioriza localStorage (keepConnected), depois sessionStorage. */
declare function getToken(): string | null;
declare function hasSession(): boolean;
/** Grava o token no storage adequado e limpa o outro para não duplicar sessão. */
declare function setToken(token: string, opts?: {
    keepConnected?: boolean;
}): void;
/** Remove o token de ambos os storages. */
declare function clear(): void;
/**
 * Inscreve um listener para mudanças de sessão. Reage a `setToken`/`clear`
 * locais e ao evento `storage` (mudanças vindas de outra aba). Retorna cleanup.
 */
declare function subscribe(listener: Listener): () => void;
/** Fachada equivalente à `voSession` do host. */
declare const voSession: {
    TOKEN_KEY: string;
    getToken: typeof getToken;
    hasSession: typeof hasSession;
    setToken: typeof setToken;
    clear: typeof clear;
    subscribe: typeof subscribe;
};

/**
 * Decodificação (NÃO verificação) do VO session token.
 *
 * Decisão α (`01-decisoes.md` Rodada 3): **o VO JWT é a identidade universal**.
 * O token é opaco/HS256, issuer `igreen-virtual-office`, e carrega `sub =
 * idconsultor`. A ASSINATURA é verificada no backend (cada API de módulo passa
 * a aceitar o VO JWT); o browser só decodifica o payload para exibir/rotear a
 * identidade. Nunca confie neste decode para autorização — só para UI/escopo de
 * exibição. O escopo de dados real vem sempre do token verificado no servidor
 * (INVARIANTE #1 do VO).
 */
interface VoJwtClaims {
    /** idconsultor, como string (padrão JWT). */
    sub?: string;
    email?: string;
    iss?: string;
    iat?: number;
    exp?: number;
    [k: string]: unknown;
}
/** Decodifica o payload do VO JWT. Retorna `null` se malformado. */
declare function decodeVoJwt(token: string | null | undefined): VoJwtClaims | null;
/** Extrai `idconsultor` (= `sub`) do VO JWT. Núcleo da decisão α. */
declare function idconsultorFromToken(token: string | null | undefined): number | null;
/** `true` se o `exp` do token já passou (skew de 0s). Útil pra evitar fetch fadado. */
declare function isTokenExpired(token: string | null | undefined): boolean;

/**
 * Registry de módulos — a fonte-da-verdade declarativa que liga
 * módulo → namespace de rota → itens de menu → flags (D6).
 *
 * Referência: module-federation.md §2b/§2c (params de menu — D6) e §2b (registry
 * como feature-flag). As flags por item de menu encodam a regra do dono D6:
 *  - `surfaceInVOSidebar`: o item aparece na sidebar do VO (menus concentram na
 *     camada do VO quando o módulo é renderizado por ele);
 *  - `admin`: rota admin — NUNCA exposta no VO (fora da sidebar E fora do
 *     `expose './Routes'` VO-facing → 2 barreiras);
 *  - `voTriggerable`: rota específica ACIONÁVEL direto pelo menu do VO
 *     (deep-link no namespace, mesmo que "admin-ish" no módulo).
 */
type ModuleId = 'rankings' | 'academy' | 'eventos';
/** Como o módulo obtém auth (auth-unificada.md). α ⇒ `vo-jwt` é o alvo. */
type ModuleSession = 'vo-jwt' | 'firebase-bridge' | 'public';
interface ModuleMenuItem {
    /** Rótulo exibido na sidebar do VO. */
    label: string;
    /** Nome do ícone lucide (string; o host mapeia string → componente). */
    icon: string;
    /** Rota RELATIVA ao namespace do módulo (ex.: '/mapa-cidades'). */
    to: string;
    /** Grupo da sidebar onde o item é agrupado (ex.: 'Rankings'). */
    group: string;
    /** D6: aparece na sidebar do VO. `false` = existe na rota, mas sem item. */
    surfaceInVOSidebar: boolean;
    /** D6: o menu do VO pode invocar esta rota direto (deep-link acionável). */
    voTriggerable: boolean;
    /** D6: rota admin — NUNCA exposta no VO (sidebar + expose). Default `false`. */
    admin?: boolean;
}
interface ModuleManifest {
    id: ModuleId;
    /** Prefixo de rota e `base` do remote (ex.: '/rankings'). */
    namespace: string;
    /** URL do `remoteEntry.js` — MESMA origem (A1, domínio único). */
    remoteEntry: string;
    /** Nome exposto pelo remote: subárvore RR sem `<Router>` (§3). */
    expose: string;
    /** Estratégia de sessão do módulo. */
    session: ModuleSession;
    /** Itens de menu. Só entram na sidebar do VO os `surfaceInVOSidebar && !admin`. */
    menu: ModuleMenuItem[];
    /** Feature-flag / rollout — liga o módulo sem tocar em rota. */
    enabled: boolean;
}
/** Item já resolvido para a sidebar do VO (com `to` absoluto = namespace + to). */
interface VOSidebarItem {
    module: ModuleId;
    group: string;
    label: string;
    icon: string;
    /** Rota absoluta pronta para `<NavLink to>` no host (ex.: '/rankings/mapa-cidades'). */
    to: string;
    voTriggerable: boolean;
}
/** Grupo de itens da sidebar do VO. */
interface VOSidebarGroup {
    group: string;
    items: VOSidebarItem[];
}

/**
 * Registry de referência com os 3 módulos-alvo. Os itens de menu vêm das
 * classificações reais em `maps/<módulo>/rotas-e-menus.md` (VO-surfaceable /
 * admin-não-expor). Este objeto é o exemplo; em produção pode ser carregado de
 * config/feature-flag, mas o TIPO (`ModuleManifest[]`) é o contrato.
 */
declare const moduleRegistry: ModuleManifest[];
/** Módulos ligados pela feature-flag. */
declare function enabledModules(registry?: ModuleManifest[]): ModuleManifest[];
declare function moduleById(id: ModuleId, registry?: ModuleManifest[]): ModuleManifest | undefined;
/** Resolve o módulo dono de um pathname (ex.: '/rankings/mapa-cidades'). */
declare function moduleByPath(pathname: string, registry?: ModuleManifest[]): ModuleManifest | undefined;
/**
 * Itens que o VO deve pintar na sidebar: dos módulos habilitados, só os
 * `surfaceInVOSidebar && !admin`, com `to` já absoluto (namespace + to).
 * É isto que o host mescla no `NAV_GROUPS` (D6 §2c-1).
 */
declare function voSidebarItems(registry?: ModuleManifest[]): VOSidebarItem[];
/** Mesmos itens da sidebar, já agrupados por `group` (ordem de 1ª aparição). */
declare function voSidebarGroups(registry?: ModuleManifest[]): VOSidebarGroup[];
/** Rotas acionáveis direto pelo menu do VO (deep-link), com `to` absoluto. */
declare function voTriggerableRoutes(registry?: ModuleManifest[]): VOSidebarItem[];
/** `true` se o pathname cai numa rota admin de algum módulo (barreira de expose). */
declare function isAdminRoute(pathname: string, registry?: ModuleManifest[]): boolean;

/**
 * ModuleSlot — monta a subárvore `<Routes>`-less de um remote federado sob um
 * namespace de rota, espelhando como o VO monta filhos lazy sob o `<Outlet/>` do
 * AppLayout (`ui/src/routes/router.tsx` filhos + `AppLayout.tsx:254`).
 *
 * O host usa numa rota splat dentro dos filhos do AppLayout:
 *
 *   const RankingsRoutes = lazy(() => import('rankings/Routes'));
 *   { path: 'rankings/*', element: (
 *       <Suspense fallback={<Loading/>}>
 *         <ModuleSlot module="rankings"><RankingsRoutes /></ModuleSlot>
 *       </Suspense>
 *   ) }
 *
 * Responsabilidades:
 *  - prover `HostContext={{ shell:'vo', module, namespace }}` (D6 §2c-2) → o remote
 *    suprime sua própria nav;
 *  - `<Suspense>` local (carregamento do chunk MF) + Error Boundary (remote fora
 *    do ar não derruba o host — sidebar/topbar do VO persistem);
 *  - NÃO cria layout novo: já renderiza dentro do `<main>` do AppLayout.
 *
 * Não depende de react-router de propósito: o host é dono do history e o
 * `basename`/splat é configurado na rota do host, não aqui.
 */
interface ModuleSlotProps {
    /** Módulo federado sendo montado. Resolve namespace no registry. */
    module: ModuleId;
    /** A subárvore do remote (o componente lazy importado de `<module>/Routes`). */
    children: ReactNode;
    /** Override do registry, se o host não usar o `moduleRegistry` padrão. */
    manifest?: ModuleManifest;
    /** Fallback do Suspense (carregando o chunk do remote). */
    fallback?: ReactNode;
    /** Fallback quando o remote falha ao carregar/renderizar. */
    errorFallback?: (error: Error) => ReactNode;
}
declare function ModuleSlot({ module, children, manifest, fallback, errorFallback, }: ModuleSlotProps): react.JSX.Element;

/**
 * HostContext — sinaliza ao remote QUEM o está renderizando (D6 §2c-2).
 *
 * Também mora neste pacote singleton, então cruza a fronteira do MF junto com a
 * sessão. Um remote lê `useHostContext()` e:
 *  - `shell:'vo'`      → SUPRIME sua própria navegação global (hub/sidebar/"voltar")
 *                        porque os menus concentram na camada do VO;
 *  - `shell:'standalone'` (default, sem provider) → renderiza sua nav normalmente.
 */
interface HostContextValue {
    shell: 'vo' | 'standalone';
    /** Módulo sendo montado (quando `shell:'vo'`). */
    module?: ModuleId;
    /** Namespace de rota sob o qual o módulo está montado (ex.: '/rankings'). */
    namespace?: string;
}
interface HostProviderProps {
    value: HostContextValue;
    children: ReactNode;
}
declare function HostProvider({ value, children }: HostProviderProps): react.JSX.Element;
/** Lê o contexto do host. Fora de um `<ModuleSlot>` retorna `{ shell:'standalone' }`. */
declare function useHostContext(): HostContextValue;
/** Açúcar: `true` quando o módulo está sendo renderizado dentro do VO. */
declare function useIsInVOShell(): boolean;

/**
 * `federationShared` — a lista canônica de `shared` (singletons) para o
 * `@module-federation/vite`, validada pelo spike (`spike-federation.md` §2/§4/§6).
 *
 * Regra dura do spike: React singleton NÃO basta para o Context cruzar a
 * fronteira — o OBJETO Context precisa ser o mesmo dos dois lados, então o pacote
 * que o carrega (`@igreen/platform-shell`) também é `singleton: true`. Este
 * helper devolve exatamente:
 *   - `react` / `react-dom` como singleton ESTRITO;
 *   - `@igreen/platform-shell` como singleton (carrega SessionContext + HostContext);
 *   - `build.target: 'chrome89'` (o runtime do MF usa top-level await).
 *
 * Host e TODOS os remotes usam o MESMO bloco. Extenda com `extraSingletons` para
 * a cadeia do Design System quando federar o DS (module-federation.md §2d).
 */
interface SharedEntry {
    singleton?: boolean;
    strictVersion?: boolean;
    requiredVersion?: string;
}
type SharedConfig = Record<string, SharedEntry>;
interface FederationSharedOptions {
    /** `requiredVersion` de react/react-dom. Default `^19.2.0` (régua do host VO). */
    reactVersion?: string;
    /** `requiredVersion` do pacote shell. Default: sem trava (aceita a resolvida). */
    shellVersion?: string;
    /** Nome do pacote shell singleton. Default `@igreen/platform-shell`. */
    packageName?: string;
    /**
     * Singletons extras a mesclar (ex.: `@tanstack/react-query`, `react-router-dom`,
     * e a cadeia do Design System). Sobrescreve as entradas base por chave.
     */
    extraSingletons?: SharedConfig;
}
/** Alvo de build exigido pelo MF (top-level await). */
declare const federationBuildTarget: "chrome89";
/** Bloco `build` pronto pra espalhar no `defineConfig` (host e remotes). */
declare const federationBuild: {
    readonly target: "chrome89";
};
/**
 * Retorna o mapa `shared` para passar ao `federation({ shared })`.
 * (React/ReactDOM singleton estrito + este pacote singleton + extras.)
 */
declare function federationShared(opts?: FederationSharedOptions): SharedConfig;
/**
 * Conveniência: `{ shared, build }` de uma vez, pronto pra compor o vite.config
 * do host e de cada remote.
 *
 *   import { federation } from '@module-federation/vite';
 *   import { federationShared, federationBuild } from '@igreen/platform-shell';
 *   // plugins: [ react(), federation({ name, remotes, shared: federationShared() }) ]
 *   // build: federationBuild
 */
declare function federationDefaults(opts?: FederationSharedOptions): {
    shared: SharedConfig;
    build: {
        target: typeof federationBuildTarget;
    };
};

export { type Consultant, type FederationSharedOptions, type HostContextValue, HostProvider, type HostProviderProps, type ModuleId, type ModuleManifest, type ModuleMenuItem, type ModuleSession, ModuleSlot, type ModuleSlotProps, SessionProvider, type SessionProviderProps, type SessionValue, type SharedConfig, type SharedEntry, TOKEN_KEY, type VOSidebarGroup, type VOSidebarItem, type VoJwtClaims, consultantQueryKey, decodeVoJwt, enabledModules, federationBuild, federationBuildTarget, federationDefaults, federationShared, idconsultorFromToken, isAdminRoute, isTokenExpired, moduleById, moduleByPath, moduleRegistry, useHostContext, useIsInVOShell, useSession, useSessionOptional, voSession, voSidebarGroups, voSidebarItems, voTriggerableRoutes };
