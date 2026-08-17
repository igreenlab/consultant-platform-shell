import { createContext, useState, useEffect, useMemo, useCallback, useContext, Suspense, Component } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { jsx, jsxs } from 'react/jsx-runtime';

// src/session/SessionProvider.tsx

// src/session/session-storage.ts
var TOKEN_KEY = "vo_session_token";
var listeners = /* @__PURE__ */ new Set();
function notify() {
  for (const l of listeners) l();
}
function getStorage(kind) {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}
function safeGet(storage) {
  if (!storage) return null;
  try {
    return storage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function getToken() {
  return safeGet(getStorage("local")) ?? safeGet(getStorage("session"));
}
function hasSession() {
  return !!getToken();
}
function setToken(token, opts = {}) {
  const { keepConnected = false } = opts;
  const local = getStorage("local");
  const session = getStorage("session");
  try {
    if (keepConnected) {
      local?.setItem(TOKEN_KEY, token);
      session?.removeItem(TOKEN_KEY);
    } else {
      session?.setItem(TOKEN_KEY, token);
      local?.removeItem(TOKEN_KEY);
    }
  } catch {
  }
  notify();
}
function clear() {
  try {
    getStorage("local")?.removeItem(TOKEN_KEY);
    getStorage("session")?.removeItem(TOKEN_KEY);
  } catch {
  }
  notify();
}
function subscribe(listener) {
  listeners.add(listener);
  const onStorage = typeof window === "undefined" ? null : (e) => {
    if (e.key === TOKEN_KEY || e.key === null) listener();
  };
  if (onStorage) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (onStorage) window.removeEventListener("storage", onStorage);
  };
}
var voSession = {
  TOKEN_KEY,
  getToken,
  hasSession,
  setToken,
  clear,
  subscribe
};

// src/session/jwt.ts
function b64urlDecode(segment) {
  try {
    const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
    let binary;
    if (typeof atob === "function") {
      binary = atob(padded);
    } else {
      binary = globalThis.Buffer.from(padded, "base64").toString("binary");
    }
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}
function decodeVoJwt(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const json = b64urlDecode(parts[1]);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
function idconsultorFromToken(token) {
  const sub = decodeVoJwt(token)?.sub;
  if (sub == null) return null;
  const n = Number(sub);
  return Number.isFinite(n) ? n : null;
}
function isTokenExpired(token) {
  const exp = decodeVoJwt(token)?.exp;
  if (typeof exp !== "number") return false;
  return Date.now() >= exp * 1e3;
}
var SessionContext = createContext(null);
function consultantQueryKey(token) {
  return ["consultant", token];
}
function assertSameOriginApiBase(apiBase) {
  if (!apiBase) return;
  const origin = typeof window === "undefined" ? null : window.location?.origin;
  if (!origin) return;
  let resolved;
  try {
    resolved = new URL(apiBase, origin);
  } catch {
    return;
  }
  if (resolved.origin !== origin) {
    throw new Error(
      `SessionProvider: apiBase="${apiBase}" resolve pra outra origem (${resolved.origin}) \u2014 o Bearer token do consultor n\xE3o pode sair do host. Use um path relativo.`
    );
  }
}
function makeDefaultFetchConsultant(apiBase) {
  assertSameOriginApiBase(apiBase);
  return async function defaultFetchConsultant(token) {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/v1/consultant`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const body = await res.json().catch(() => null);
    if (body && typeof body === "object" && "success" in body) {
      const env = body;
      if (env.success && env.data) return env.data;
      throw new Error(env.error?.message ?? "Falha ao carregar consultor.");
    }
    if (!res.ok) throw new Error(`GET /v1/consultant \u2192 HTTP ${res.status}`);
    return body;
  };
}
function SessionProvider({
  children,
  fetchConsultant,
  apiBase = "",
  onLogout
}) {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState(
    () => voSession.getToken()
  );
  useEffect(() => {
    return voSession.subscribe(() => setTokenState(voSession.getToken()));
  }, []);
  const idconsultor = useMemo(() => idconsultorFromToken(token), [token]);
  const loadConsultant = useMemo(
    () => fetchConsultant ?? makeDefaultFetchConsultant(apiBase),
    [fetchConsultant, apiBase]
  );
  const { data: consultant, isLoading } = useQuery({
    queryKey: consultantQueryKey(token),
    queryFn: () => loadConsultant(token),
    enabled: !!token && !isTokenExpired(token)
  });
  const login = useCallback(
    (newToken, opts) => {
      voSession.setToken(newToken, opts);
      setTokenState(newToken);
    },
    []
  );
  const logout = useCallback(() => {
    voSession.clear();
    setTokenState(null);
    queryClient.clear();
    onLogout?.();
  }, [queryClient, onLogout]);
  useEffect(() => {
    if (!token) return;
    if (isTokenExpired(token)) {
      logout();
      return;
    }
    const exp = decodeVoJwt(token)?.exp;
    if (typeof exp !== "number") return;
    const ms = exp * 1e3 - Date.now();
    if (ms <= 0 || ms > 2147483647) return;
    const timer = setTimeout(logout, ms);
    return () => clearTimeout(timer);
  }, [token, logout]);
  const value = useMemo(
    () => ({
      token,
      idconsultor,
      consultant: consultant ?? null,
      isLoading: !!token && isLoading,
      login,
      logout
    }),
    [token, idconsultor, consultant, isLoading, login, logout]
  );
  return /* @__PURE__ */ jsx(SessionContext.Provider, { value, children });
}
function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error(
      "useSession() deve ser usado dentro de <SessionProvider>. Num remote federado, isto normalmente indica que @igreen/platform-shell N\xC3O est\xE1 como shared singleton no Module Federation."
    );
  }
  return ctx;
}
function useSessionOptional() {
  return useContext(SessionContext);
}

// src/registry/moduleRegistry.ts
var moduleRegistry = [
  {
    id: "rankings",
    label: "Rankings",
    icon: "Trophy",
    order: 1,
    namespace: "/rankings",
    remoteEntry: "/rankings/assets/remoteEntry.js",
    expose: "./Routes",
    session: "public",
    // vitrine pública (rankings/auth.md)
    enabled: true,
    menu: [
      {
        label: "Mapa de Cidades",
        icon: "MapPinned",
        to: "/mapa-cidades",
        group: "Rankings",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      {
        label: "Ranking de Eventos",
        icon: "Trophy",
        to: "/eventos",
        group: "Rankings",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      {
        label: "Ranking Verticais",
        icon: "BarChart3",
        to: "/ranking-verticais",
        group: "Rankings",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      {
        label: "Cruzeiro Gusttavo Lima",
        icon: "Ship",
        to: "/cruzeiro-gusttavo-lima",
        group: "Campanhas",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      // Admin — NÃO exposto no VO (2 barreiras: fora da sidebar + fora do expose).
      {
        label: "Ranking de Cotas",
        icon: "Lock",
        to: "/ranking-cotas",
        group: "Rankings",
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true
      },
      {
        label: "Acionistas",
        icon: "Lock",
        to: "/acionistas",
        group: "Rankings",
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true
      }
    ]
  },
  {
    id: "academy",
    label: "Academy",
    icon: "GraduationCap",
    order: 2,
    namespace: "/academy",
    remoteEntry: "/academy/assets/remoteEntry.js",
    expose: "./Routes",
    session: "firebase-bridge",
    // SSO: VO emite custom token Firebase (docs/migration/academy-sso.md no VO)
    enabled: true,
    menu: [
      {
        label: "Material de Apoio",
        icon: "GraduationCap",
        to: "/",
        // categorias são data-driven na tela (MF-3 [decidir])
        group: "Academy",
        surfaceInVOSidebar: true,
        voTriggerable: true
      }
    ]
  },
  {
    id: "eventos",
    label: "Eventos",
    icon: "Calendar",
    order: 3,
    namespace: "/eventos",
    remoteEntry: "/eventos/assets/remoteEntry.js",
    expose: "./Routes",
    session: "vo-jwt",
    // ponte vo-jwt no backend do eventos (auth.js) — pronta
    enabled: true,
    // backend re-plataformado (Postgres) + cutover concluído 2026-07
    menu: [
      {
        label: "Agenda",
        icon: "Calendar",
        to: "/calendario",
        group: "Eventos",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      {
        label: "Meus Convites",
        icon: "Ticket",
        to: "/meus-convites",
        group: "Eventos",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      {
        label: "Convites na Equipe",
        icon: "Users",
        to: "/convites-equipe",
        group: "Eventos",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      // Lista/gestão de eventos (EventsManagerPage). Volta pra sidebar do VO (pedido
      // do dono); os botões de AÇÃO admin/acionista DENTRO dela seguem ocultos sob o
      // shell ({!inShell}) — só a lista/CRUD de eventos fica acessível.
      {
        label: "Lista de Eventos",
        icon: "CalendarCog",
        to: "/admin/eventos",
        group: "Eventos",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      {
        label: "Gest\xE3o de Convites",
        icon: "Mailbox",
        to: "/evento/:id/admin",
        // deep-link paramétrico; estados internos não são roteáveis
        group: "Eventos",
        surfaceInVOSidebar: false,
        // precisa de :id → não vira item fixo de sidebar
        voTriggerable: true
      }
    ]
  },
  {
    id: "creators",
    label: "Creators",
    icon: "Rocket",
    // mesmo ícone do contexto no standalone (creator-hub App.tsx)
    order: 4,
    namespace: "/creators",
    remoteEntry: "/creators/assets/remoteEntry.js",
    expose: "./Routes",
    // SSO: a API do Creator Hub (terceiro — Mix Ideias) já troca Firebase ID
    // token por sessão própria em POST /api/v1/auth/igreen — mesma ponte do
    // Academy. Confirmar o project ID com a Mix Ideias (Fase 0); se divergir,
    // plano B = 'vo-jwt' (backend deles validar o VO JWT).
    session: "firebase-bridge",
    // Ligado junto do bake-in do remote no vo-ui (F3, 2026-07). Rollout por
    // ambiente segue no ponteiro do submódulo do host: develop (dev-escritorio)
    // primeiro; prod só quando o main do VO bumpar o submódulo (prod/ui/deploy.sh
    // já builda o creators-remote:prod desde o mesmo F3).
    enabled: true,
    menu: [
      {
        label: "Painel",
        icon: "LayoutDashboard",
        to: "/",
        group: "Creators",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      {
        label: "Meus v\xEDdeos",
        icon: "Video",
        to: "/videos",
        group: "Creators",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      {
        label: "Ranking",
        icon: "Trophy",
        to: "/ranking",
        group: "Creators",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      {
        label: "Academy",
        icon: "GraduationCap",
        to: "/academy",
        group: "Creators",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      {
        label: "Est\xFAdio de IA",
        icon: "Sparkles",
        to: "/ia",
        group: "Creators",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      {
        label: "Regras",
        icon: "ClipboardList",
        to: "/regras",
        group: "Creators",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      {
        label: "Minha conta",
        icon: "UserCog",
        to: "/conta",
        group: "Creators",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      {
        label: "Ajuda",
        icon: "CircleHelp",
        to: "/ajuda",
        group: "Creators",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      // Atalhos da conta (no standalone vivem no user-menu do AppShell, não na
      // sidebar). Existem como rota, sem item de menu no VO.
      {
        label: "Minhas redes",
        icon: "AtSign",
        to: "/redes",
        group: "Minha conta",
        surfaceInVOSidebar: false,
        voTriggerable: false
      },
      {
        label: "Dados de pagamento",
        icon: "CreditCard",
        to: "/pagamento",
        group: "Minha conta",
        surfaceInVOSidebar: false,
        voTriggerable: false
      },
      {
        label: "Conex\xF5es",
        icon: "Link2",
        to: "/conexoes",
        group: "Minha conta",
        surfaceInVOSidebar: false,
        voTriggerable: false
      },
      {
        label: "Seguran\xE7a",
        icon: "ShieldCheck",
        to: "/seguranca",
        group: "Minha conta",
        surfaceInVOSidebar: false,
        voTriggerable: false
      },
      // Admin — NÃO exposto no VO (2 barreiras: fora da sidebar + fora do
      // expose './Routes'). Gestão segue no standalone (creators.igreenenergy…).
      {
        label: "Modera\xE7\xE3o",
        icon: "Lock",
        to: "/admin-moderacao",
        group: "Administra\xE7\xE3o",
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true
      },
      {
        label: "Campanhas",
        icon: "Lock",
        to: "/admin-campanhas",
        group: "Administra\xE7\xE3o",
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true
      },
      {
        label: "Regras (admin)",
        icon: "Lock",
        to: "/admin-regras",
        group: "Administra\xE7\xE3o",
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true
      },
      {
        label: "Usu\xE1rios",
        icon: "Lock",
        to: "/admin-usuarios",
        group: "Administra\xE7\xE3o",
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true
      },
      {
        label: "Laborat\xF3rio",
        icon: "Lock",
        to: "/admin-laboratorio",
        group: "Administra\xE7\xE3o",
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true
      },
      {
        label: "Rede neural",
        icon: "Lock",
        to: "/admin-rede",
        group: "Administra\xE7\xE3o",
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true
      },
      {
        label: "Financeiro",
        icon: "Lock",
        to: "/admin-financeiro",
        group: "Administra\xE7\xE3o",
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true
      },
      {
        label: "Pagamentos",
        icon: "Lock",
        to: "/admin-pagamentos",
        group: "Administra\xE7\xE3o",
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true
      },
      {
        label: "Configura\xE7\xE3o",
        icon: "Lock",
        to: "/admin-config",
        group: "Administra\xE7\xE3o",
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true
      }
    ]
  },
  {
    id: "store",
    label: "Loja",
    icon: "Store",
    order: 5,
    namespace: "/store",
    remoteEntry: "/store/assets/remoteEntry.js",
    expose: "./Routes",
    // SSO: a api-igreen-store JÁ troca um JWT iGreen pelo cookie de sessão em
    // POST /auth/session — mas exige o MESMO segredo e a MESMA audience
    // (aud=igreen-store) que o login dela emite, então o voSession não serve
    // direto. A ponte é 'vo-jwt': a api-store valida o JWT do VO e emite o
    // token dela (F4), mesmo desenho do eventos.
    session: "vo-jwt",
    // Ligado no F3, junto do bake-in do store-remote no vo-ui. O rollout por
    // ambiente segue no ponteiro do submódulo do host: develop (dev-escritorio)
    // primeiro; prod só quando o main do VO bumpar o submódulo.
    enabled: true,
    // Escopo federado = fluxo de compra do licenciado. As 9 páginas
    // institucionais (empresa/como-comprar/envio/garantia/...) e o /login
    // ficam FORA do expose: dentro do Escritório são ruído, e a sessão vem
    // por SSO. Elas seguem existindo no standalone igreenstore.com.br.
    menu: [
      {
        label: "Loja",
        icon: "Store",
        to: "/",
        group: "Loja",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      {
        label: "Carrinho",
        icon: "ShoppingCart",
        to: "/carrinho",
        group: "Loja",
        surfaceInVOSidebar: true,
        voTriggerable: true
      },
      {
        label: "Meus pedidos",
        icon: "Package",
        to: "/pedidos",
        group: "Loja",
        surfaceInVOSidebar: true,
        voTriggerable: true
      }
    ]
  }
];
function enabledModules(registry = moduleRegistry) {
  return registry.filter((m) => m.enabled);
}
function moduleById(id, registry = moduleRegistry) {
  return registry.find((m) => m.id === id);
}
function moduleByPath(pathname, registry = moduleRegistry) {
  return registry.find(
    (m) => pathname === m.namespace || pathname.startsWith(`${m.namespace}/`)
  );
}
function voSidebarItems(registry = moduleRegistry) {
  return enabledModules(registry).flatMap(
    (m) => m.menu.filter((item) => item.surfaceInVOSidebar && !item.admin).map((item) => ({
      module: m.id,
      group: item.group,
      label: item.label,
      icon: item.icon,
      to: joinPath(m.namespace, item.to),
      voTriggerable: item.voTriggerable
    }))
  );
}
function voSidebarGroups(registry = moduleRegistry) {
  const order = [];
  const byGroup = /* @__PURE__ */ new Map();
  for (const item of voSidebarItems(registry)) {
    if (!byGroup.has(item.group)) {
      byGroup.set(item.group, []);
      order.push(item.group);
    }
    byGroup.get(item.group).push(item);
  }
  return order.map((group) => ({ group, items: byGroup.get(group) }));
}
function voModules(registry = moduleRegistry) {
  return enabledModules(registry).map((m, i) => ({ m, i })).sort((a, b) => (a.m.order ?? a.i) - (b.m.order ?? b.i) || a.i - b.i).map(({ m }) => ({
    id: m.id,
    label: m.label,
    icon: m.icon,
    namespace: m.namespace
  }));
}
function voTriggerableRoutes(registry = moduleRegistry) {
  return enabledModules(registry).flatMap(
    (m) => m.menu.filter((item) => item.voTriggerable && !item.admin).map((item) => ({
      module: m.id,
      group: item.group,
      label: item.label,
      icon: item.icon,
      to: joinPath(m.namespace, item.to),
      voTriggerable: true
    }))
  );
}
function isAdminRoute(pathname, registry = moduleRegistry) {
  const mod = moduleByPath(pathname, registry);
  if (!mod) return false;
  const rel = pathname.slice(mod.namespace.length) || "/";
  return mod.menu.some((item) => item.admin && matchRel(item.to, rel));
}
function joinPath(namespace, to) {
  if (to === "/" || to === "") return namespace;
  return `${namespace}${to.startsWith("/") ? "" : "/"}${to}`;
}
function matchRel(pattern, actual) {
  const p = pattern.split("/").filter(Boolean);
  const a = actual.split("/").filter(Boolean);
  if (p.length === 0) return a.length === 0;
  if (p.length > a.length) return false;
  return p.every((seg, i) => seg.startsWith(":") || seg === a[i]);
}
var DEFAULT_HOST_CONTEXT = { shell: "standalone" };
var HostContext = createContext(DEFAULT_HOST_CONTEXT);
function HostProvider({ value, children }) {
  return /* @__PURE__ */ jsx(HostContext.Provider, { value, children });
}
function useHostContext() {
  return useContext(HostContext);
}
function useIsInVOShell() {
  return useHostContext().shell === "vo";
}
var ModuleErrorBoundary = class extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) return this.props.fallback(this.state.error);
    return this.props.children;
  }
};
function DefaultFallback() {
  return null;
}
function defaultErrorFallback(error) {
  return /* @__PURE__ */ jsxs("div", { role: "alert", style: { padding: 24 }, children: [
    "N\xE3o foi poss\xEDvel carregar este m\xF3dulo. ",
    error.message
  ] });
}
function ModuleSlot({
  module,
  children,
  manifest,
  fallback,
  errorFallback = defaultErrorFallback
}) {
  const resolved = manifest ?? moduleById(module);
  const namespace = resolved?.namespace;
  return /* @__PURE__ */ jsx(HostProvider, { value: { shell: "vo", module, namespace }, children: /* @__PURE__ */ jsx(ModuleErrorBoundary, { fallback: errorFallback, children: /* @__PURE__ */ jsx(Suspense, { fallback: fallback ?? /* @__PURE__ */ jsx(DefaultFallback, {}), children }) }) });
}

// src/federation/federationShared.ts
var DEFAULT_PACKAGE = "@igreen/platform-shell";
var DEFAULT_REACT_VERSION = "^19.2.0";
var federationBuildTarget = "chrome89";
var federationBuild = { target: federationBuildTarget };
function federationShared(opts = {}) {
  const {
    reactVersion = DEFAULT_REACT_VERSION,
    shellVersion,
    packageName = DEFAULT_PACKAGE,
    extraSingletons = {}
  } = opts;
  const react = {
    singleton: true,
    strictVersion: true,
    requiredVersion: reactVersion
  };
  const base = {
    react: { ...react },
    "react-dom": { ...react },
    [packageName]: {
      singleton: true,
      ...shellVersion ? { requiredVersion: shellVersion } : {}
    }
  };
  return { ...base, ...extraSingletons };
}
function federationDefaults(opts = {}) {
  return { shared: federationShared(opts), build: { ...federationBuild } };
}

export { HostProvider, ModuleSlot, SessionProvider, TOKEN_KEY, consultantQueryKey, decodeVoJwt, enabledModules, federationBuild, federationBuildTarget, federationDefaults, federationShared, idconsultorFromToken, isAdminRoute, isTokenExpired, moduleById, moduleByPath, moduleRegistry, useHostContext, useIsInVOShell, useSession, useSessionOptional, voModules, voSession, voSidebarGroups, voSidebarItems, voTriggerableRoutes };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map