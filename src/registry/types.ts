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

export type ModuleId = 'rankings' | 'academy' | 'eventos';

/** Como o módulo obtém auth (auth-unificada.md). α ⇒ `vo-jwt` é o alvo. */
export type ModuleSession = 'vo-jwt' | 'firebase-bridge' | 'public';

export interface ModuleMenuItem {
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

export interface ModuleManifest {
  id: ModuleId;
  /** Rótulo do MÓDULO na rail do VO (menu de 2 colunas — 1 ícone por módulo). */
  label: string;
  /** Ícone lucide (string; host mapeia → componente) do MÓDULO na rail. */
  icon: string;
  /** Ordem no rail (menor = mais acima). Ausente = ordem do array. */
  order?: number;
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
export interface VOSidebarItem {
  module: ModuleId;
  group: string;
  label: string;
  icon: string;
  /** Rota absoluta pronta para `<NavLink to>` no host (ex.: '/rankings/mapa-cidades'). */
  to: string;
  voTriggerable: boolean;
}

/** Grupo de itens da sidebar do VO. */
export interface VOSidebarGroup {
  group: string;
  items: VOSidebarItem[];
}

/** Módulo resolvido para a RAIL do VO (1 ícone por módulo — menu 2 colunas). */
export interface VOModule {
  id: ModuleId;
  label: string;
  /** Nome do ícone lucide (string) — o host mapeia string → componente. */
  icon: string;
  namespace: string;
}
