/**
 * `@igreen/platform-shell` — contrato de shell/federation do Virtual Office.
 *
 * 4 exports centrais (module-federation.md §2):
 *   1. SessionProvider / useSession — sessão única (VO JWT — decisão α)
 *   2. moduleRegistry               — módulo → namespace → menu → flags (D6)
 *   3. ModuleSlot                   — monta o remote sob o namespace (Outlet-like)
 *   4. federationShared             — bloco `shared` singleton p/ o vite.config
 *
 * ★ Este pacote é o `shared: { singleton: true }` do Module Federation: os
 * objetos Context (sessão + host) precisam ter identidade única nos dois lados
 * da fronteira. Ver spike-federation.md §4.
 */

// 1 ── Sessão única (VO JWT como identidade universal — decisão α)
export { SessionProvider, useSession, useSessionOptional, consultantQueryKey } from './session/SessionProvider';
export type { SessionProviderProps } from './session/SessionProvider';
export type { Consultant, SessionValue } from './session/types';
export { voSession, TOKEN_KEY } from './session/session-storage';
export { decodeVoJwt, idconsultorFromToken, isTokenExpired } from './session/jwt';
export type { VoJwtClaims } from './session/jwt';

// 2 ── Registry de módulos (D6)
export {
  moduleRegistry,
  enabledModules,
  moduleById,
  moduleByPath,
  voModules,
  voSidebarItems,
  voSidebarGroups,
  voTriggerableRoutes,
  isAdminRoute,
} from './registry/moduleRegistry';
export type {
  ModuleId,
  ModuleSession,
  ModuleMenuItem,
  ModuleManifest,
  VOModule,
  VOSidebarItem,
  VOSidebarGroup,
} from './registry/types';

// 3 ── Slot do módulo + HostContext (D6 §2c-2)
export { ModuleSlot } from './slot/ModuleSlot';
export type { ModuleSlotProps } from './slot/ModuleSlot';
export {
  HostProvider,
  useHostContext,
  useIsInVOShell,
} from './slot/HostContext';
export type { HostContextValue, HostProviderProps } from './slot/HostContext';

// 4 ── Config de Module Federation (singletons validados pelo spike)
export {
  federationShared,
  federationDefaults,
  federationBuild,
  federationBuildTarget,
} from './federation/federationShared';
export type {
  SharedConfig,
  SharedEntry,
  FederationSharedOptions,
} from './federation/federationShared';
