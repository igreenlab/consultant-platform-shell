# `@igreen/platform-shell` — o contrato de federação do VO

The core **contract** that lets the iGreen **Virtual Office (VO)** host federated
modules (Rankings / Academy / Eventos) via **Module Federation** under a single
domain. The key insight: React as a strict singleton is *not enough* for a React
Context to cross the MF boundary — the Context **object** must live in a package
marked `shared: { singleton: true }`. **This package is that package.**

> **Status: EM PRODUÇÃO.** Consumido pelo **host VO** como submódulo `workspace:*`
> (em `virtual-office/platform-shell/`) e por **cada módulo remoto** como git-dep
> `git+ssh` pinado. Rankings, Academy e Eventos rodam federados no VO em produção.
>
> 👉 **Integrando um módulo novo?** O passo-a-passo completo (registry → exposes →
> bake → deploy → auth) está em **[`../docs/FEDERATION.md`](../docs/FEDERATION.md)** e a
> visão macro no **[README do VO](../README.md#-arquitetura-federada--integrar-um-novo-módulo)**.
> Este README foca na **API do pacote** (o que ele exporta e como fiar).

## Proof it builds

```
pnpm install     # React 19.2.7, @tanstack/react-query 5.101.2, tsup 8.5.1, typescript 5.9.3
pnpm build       # tsup → dist/index.js (ESM) + dist/index.cjs (CJS) + dist/index.d.ts
pnpm typecheck   # tsc --noEmit → 0 errors
pnpm test        # node:test → 16/16 pass (incl. an SSR render proving session+host
                 # context cross into a simulated remote)
```

`pnpm check` runs build + test together.

---

## Public API (4 exports + helpers)

### 1. `SessionProvider` / `useSession` — the single session (decision α)

Holds the **VO session** as the universal identity (decision **α**,
`01-decisoes.md` Rodada 3): the VO JWT (`vo_session_token`) is the identity every
module verifies; `sub = idconsultor`. Evolves the VO's `SessionProvider.tsx`
(same `['consultant', token]` TanStack query) but decoupled from react-router
(host owns history) and from the VO's private axios client (fetcher is injectable).

```ts
import { SessionProvider, useSession } from '@igreen/platform-shell';

// value shape read by host AND remotes:
interface SessionValue {
  token: string | null;        // vo_session_token (Bearer)
  idconsultor: number | null;  // decoded from JWT `sub`, synchronous (α)
  consultant: Consultant | null;
  isLoading: boolean;
  login: (token: string, opts?: { keepConnected?: boolean }) => void;
  logout: () => void;
}
```

Props: `fetchConsultant?` (inject the VO `api` client; defaults to
`GET {apiBase}/v1/consultant` unwrapping the VO `{success,data}` envelope),
`apiBase?`, `onLogout?` (host wires navigation, e.g. `navigate('/login')`).

Also exported: `useSessionOptional()`, `consultantQueryKey(token)`,
`voSession` (`getToken`/`setToken`/`clear`/`subscribe`, key `vo_session_token`),
`decodeVoJwt`, `idconsultorFromToken`, `isTokenExpired`.

> The JWT is **decoded** for identity/UI only — never verified in the browser.
> Data scope always comes from the token verified on the server (VO INVARIANTE #1).

### 2. `moduleRegistry` — module → namespace → menu → flags (D6)

Typed manifest (`ModuleManifest[]`). Per-menu-item flags encode D6:

| flag | meaning |
|---|---|
| `surfaceInVOSidebar` | the item appears in the **VO sidebar** (module menus concentrate in the VO layer) |
| `admin: true` | admin route — **never exposed in VO** (out of the sidebar *and* out of the VO-facing `expose`) |
| `voTriggerable` | a route the **VO menu can invoke directly** (deep-link into the namespace) |

Selectors: `enabledModules()` (feature-flag), `voSidebarItems()` /
`voSidebarGroups()` (admin-excluded, `to` made absolute — feed the host's
`NAV_GROUPS`), `voTriggerableRoutes()`, `moduleById()`, `moduleByPath()`,
`isAdminRoute()`.

### 3. `ModuleSlot` — mount a remote's `<Routes>`-less subtree

Mirrors how the VO mounts lazy children under `AppLayout`'s `<Outlet/>`. Provides
`HostContext={{ shell:'vo', module, namespace }}` (D6 §2c-2) so the remote
suppresses its own nav, plus a local `<Suspense>` and an error boundary (a
remote that's down doesn't take out the host chrome). No new layout, no
react-router dependency (host owns the splat/basename).

Companion: `HostProvider`, `useHostContext()` (defaults to
`{ shell:'standalone' }` outside a slot), `useIsInVOShell()`.

### 4. `federationShared` — the validated `shared` config

Returns the exact `@module-federation/vite` `shared` block proven by the spike:
`react`/`react-dom` as **strict singletons** + **this package** as a singleton.
Merge the DS chain / router / react-query via `extraSingletons`. Also exports
`federationBuild` (`{ target: 'chrome89' }`, for the MF top-level-await runtime)
and `federationDefaults()` (`{ shared, build }`).

---

## (a) VO host wiring

```tsx
// ui/vite.config.ts  — add MF to the existing host config
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { federationShared, federationBuild } from '@igreen/platform-shell';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'vo_shell',
      remotes: {
        // same origin (A1) — from moduleRegistry[].remoteEntry
        rankings: { type: 'module', name: 'rankings', entry: '/rankings/assets/remoteEntry.js' },
        academy:  { type: 'module', name: 'academy',  entry: '/academy/assets/remoteEntry.js'  },
      },
      shared: federationShared({
        // federate the DS + host-owned singletons too:
        extraSingletons: {
          'react-router-dom': { singleton: true, requiredVersion: '^7.0.0' },
          '@tanstack/react-query': { singleton: true },
          // '@igreen/design-system': { singleton: true },
        },
      }),
    }),
  ],
  build: federationBuild, // { target: 'chrome89' }
});
```

```tsx
// ui/src/routes/router.tsx — mount remotes as splat children of AppLayout
import { lazyWithReload } from '~/lib/lazyWithReload';
import { ModuleSlot } from '@igreen/platform-shell';

const RankingsRoutes = lazyWithReload(() => import('rankings/Routes')); // MF remote

// …inside AppLayout's children (today router.tsx:68-84):
{ path: 'rankings/*', element: lazyEl(
    <ModuleSlot module="rankings"><RankingsRoutes /></ModuleSlot>
) },
```

```tsx
// ui/src/main.tsx — the ONE SessionProvider wraps everything (host + remotes)
import { SessionProvider } from '@igreen/platform-shell';
import { api } from '~/lib/apiClient';

<QueryClientProvider client={queryClient}>
  <SessionProvider
    fetchConsultant={() => api.get('/consultant')}  // reuse the VO axios client
    onLogout={() => navigate('/login', { replace: true })}
  >
    {/* AppLayout + Outlet + ModuleSlots */}
  </SessionProvider>
</QueryClientProvider>
```

```tsx
// ui/src/layout/AppLayout.tsx — merge module menus into the sidebar (D6)
import { voSidebarGroups } from '@igreen/platform-shell';

const moduleGroups = voSidebarGroups(); // admin excluded, `to` already absolute
// render alongside the native NAV_GROUPS
```

## (b) A module exposing itself as a remote + reading `useSession()`

```ts
// <module>/vite.config.ts — SAME shared block; base = the module namespace
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { federationShared, federationBuild } from '@igreen/platform-shell';

export default defineConfig({
  base: '/rankings/',            // its route namespace (A1)
  plugins: [
    react(),
    federation({
      name: 'rankings',
      filename: 'remoteEntry.js',
      exposes: { './Routes': './src/Routes.tsx' }, // a <Routes> subtree, NO <Router>
      shared: federationShared(),  // identical singletons — React must match the host
    }),
  ],
  build: federationBuild,          // { target: 'chrome89' }
});
```

```tsx
// <module>/src/Routes.tsx — the exposed subtree: no BrowserRouter (host owns it)
import { Routes, Route } from 'react-router-dom';
import { useSession, useIsInVOShell } from '@igreen/platform-shell';

export default function ModuleRoutes() {
  const { idconsultor, consultant } = useSession(); // ← crosses the MF boundary
  const inVO = useIsInVOShell();                     // true when hosted by the VO

  return (
    <>
      {!inVO && <MyOwnSidebar />}   {/* standalone only — suppressed under the VO */}
      <Routes>
        <Route path="/mapa-cidades" element={<CityMap consultor={idconsultor} />} />
        {/* … */}
      </Routes>
    </>
  );
}
```

Because `@igreen/platform-shell` is a `shared` **singleton**, `useSession()`
inside the remote reads the value provided by the host's `SessionProvider` — the
same Context object, one React instance. If the package is *not* a singleton the
remote gets its own Context and `useSession()` throws / returns null (silent
session failure). The included `test/render.test.mjs` asserts exactly this
crossing (`remoteSeesConsultor=777`, `shell=vo`).

---

## Layout

```
src/
  index.ts                     barrel (the public API)
  session/
    SessionProvider.tsx        SessionContext (the singleton) + useSession + login/logout
    session-storage.ts         voSession port — key `vo_session_token`, subscribe
    jwt.ts                     decodeVoJwt / idconsultorFromToken (decision α)
    types.ts                   Consultant, SessionValue
  registry/
    types.ts                   ModuleManifest / ModuleMenuItem (D6 flags)
    moduleRegistry.ts          example registry (rankings/academy/eventos) + selectors
  slot/
    HostContext.tsx            HostContext (the 2nd singleton) + useHostContext
    ModuleSlot.tsx             Suspense + error boundary + HostProvider
  federation/
    federationShared.ts        the validated `shared` block + chrome89 build target
test/                          node:test (jwt, registry, federation, SSR render)
```

## Notas de integração (estado atual)

- **Home/versionamento — RESOLVIDO (era A4):** o pacote vive como **submódulo do monorepo VO** (`virtual-office/platform-shell/`), versionado pelo ponteiro do submódulo (host) + commit pinado no git-dep (remotes). Plugado e em produção.
- **Consultant fetch** — o host injeta `fetchConsultant` (default: `GET /v1/consultant` desembrulhando o envelope `{success,data}` do VO) pra o pacote não depender do axios privado do VO.
- **AuthBridge (backend por módulo)** — este pacote carrega a *identidade* (o módulo verifica o VO JWT). Fazer o backend do módulo **aceitar** o VO JWT é trabalho de backend por módulo: **o eventos já faz** (`api/routes/auth.js` → `verifyVoToken`, com `VO_SESSION_SECRET` **compartilhado** com o vo-api); o Academy (Firebase) exige a ponte SSO, que pede revisão humana.
- **DS como singleton** — `federationShared({ extraSingletons })` é a costura; enumerar a cadeia inteira do Design System (radix/dnd-kit/tanstack-virtual/lucide/recharts/…) como singletons fica na fiação do host.
```
