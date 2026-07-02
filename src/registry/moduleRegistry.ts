import type {
  ModuleId,
  ModuleManifest,
  VOSidebarGroup,
  VOSidebarItem,
} from './types';

/**
 * Registry de referência com os 3 módulos-alvo. Os itens de menu vêm das
 * classificações reais em `maps/<módulo>/rotas-e-menus.md` (VO-surfaceable /
 * admin-não-expor). Este objeto é o exemplo; em produção pode ser carregado de
 * config/feature-flag, mas o TIPO (`ModuleManifest[]`) é o contrato.
 */
export const moduleRegistry: ModuleManifest[] = [
  {
    id: 'rankings',
    namespace: '/rankings',
    remoteEntry: '/rankings/assets/remoteEntry.js',
    expose: './Routes',
    session: 'public', // vitrine pública (rankings/auth.md)
    enabled: true,
    menu: [
      {
        label: 'Mapa de Cidades',
        icon: 'MapPinned',
        to: '/mapa-cidades',
        group: 'Rankings',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      {
        label: 'Ranking de Eventos',
        icon: 'Trophy',
        to: '/eventos',
        group: 'Rankings',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      {
        label: 'Ranking Verticais',
        icon: 'BarChart3',
        to: '/ranking-verticais',
        group: 'Rankings',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      // Admin — NÃO exposto no VO (2 barreiras: fora da sidebar + fora do expose).
      {
        label: 'Ranking de Cotas',
        icon: 'Lock',
        to: '/ranking-cotas',
        group: 'Rankings',
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true,
      },
      {
        label: 'Acionistas',
        icon: 'Lock',
        to: '/acionistas',
        group: 'Rankings',
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true,
      },
    ],
  },
  {
    id: 'academy',
    namespace: '/academy',
    remoteEntry: '/academy/assets/remoteEntry.js',
    expose: './Routes',
    session: 'vo-jwt', // α: backend passa a verificar o VO JWT
    enabled: true,
    menu: [
      {
        label: 'Material de Apoio',
        icon: 'GraduationCap',
        to: '/', // categorias são data-driven na tela (MF-3 [decidir])
        group: 'Academy',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
    ],
  },
  {
    id: 'eventos',
    namespace: '/eventos',
    remoteEntry: '/eventos/assets/remoteEntry.js',
    expose: './Routes',
    session: 'vo-jwt', // após redesign de auth (eventos/auth.md)
    enabled: false, // rollout: bloqueado até o redesign de backend (auth-unificada §6.3)
    menu: [
      {
        label: 'Agenda',
        icon: 'Calendar',
        to: '/calendario',
        group: 'Eventos',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      // "admin-ish" no módulo, mas classificada VO-surfaceable → acionável direto.
      {
        label: 'Eventos',
        icon: 'CalendarCog',
        to: '/admin/eventos',
        group: 'Eventos',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      {
        label: 'Gestão de Convites',
        icon: 'Mailbox',
        to: '/evento/:id/admin', // deep-link paramétrico; estados internos não são roteáveis
        group: 'Eventos',
        surfaceInVOSidebar: false, // precisa de :id → não vira item fixo de sidebar
        voTriggerable: true,
      },
    ],
  },
];

// ── Seletores (D6) ───────────────────────────────────────────────────────────

/** Módulos ligados pela feature-flag. */
export function enabledModules(
  registry: ModuleManifest[] = moduleRegistry,
): ModuleManifest[] {
  return registry.filter((m) => m.enabled);
}

export function moduleById(
  id: ModuleId,
  registry: ModuleManifest[] = moduleRegistry,
): ModuleManifest | undefined {
  return registry.find((m) => m.id === id);
}

/** Resolve o módulo dono de um pathname (ex.: '/rankings/mapa-cidades'). */
export function moduleByPath(
  pathname: string,
  registry: ModuleManifest[] = moduleRegistry,
): ModuleManifest | undefined {
  return registry.find(
    (m) => pathname === m.namespace || pathname.startsWith(`${m.namespace}/`),
  );
}

/**
 * Itens que o VO deve pintar na sidebar: dos módulos habilitados, só os
 * `surfaceInVOSidebar && !admin`, com `to` já absoluto (namespace + to).
 * É isto que o host mescla no `NAV_GROUPS` (D6 §2c-1).
 */
export function voSidebarItems(
  registry: ModuleManifest[] = moduleRegistry,
): VOSidebarItem[] {
  return enabledModules(registry).flatMap((m) =>
    m.menu
      .filter((item) => item.surfaceInVOSidebar && !item.admin)
      .map<VOSidebarItem>((item) => ({
        module: m.id,
        group: item.group,
        label: item.label,
        icon: item.icon,
        to: joinPath(m.namespace, item.to),
        voTriggerable: item.voTriggerable,
      })),
  );
}

/** Mesmos itens da sidebar, já agrupados por `group` (ordem de 1ª aparição). */
export function voSidebarGroups(
  registry: ModuleManifest[] = moduleRegistry,
): VOSidebarGroup[] {
  const order: string[] = [];
  const byGroup = new Map<string, VOSidebarItem[]>();
  for (const item of voSidebarItems(registry)) {
    if (!byGroup.has(item.group)) {
      byGroup.set(item.group, []);
      order.push(item.group);
    }
    byGroup.get(item.group)!.push(item);
  }
  return order.map((group) => ({ group, items: byGroup.get(group)! }));
}

/** Rotas acionáveis direto pelo menu do VO (deep-link), com `to` absoluto. */
export function voTriggerableRoutes(
  registry: ModuleManifest[] = moduleRegistry,
): VOSidebarItem[] {
  return enabledModules(registry).flatMap((m) =>
    m.menu
      .filter((item) => item.voTriggerable && !item.admin)
      .map<VOSidebarItem>((item) => ({
        module: m.id,
        group: item.group,
        label: item.label,
        icon: item.icon,
        to: joinPath(m.namespace, item.to),
        voTriggerable: true,
      })),
  );
}

/** `true` se o pathname cai numa rota admin de algum módulo (barreira de expose). */
export function isAdminRoute(
  pathname: string,
  registry: ModuleManifest[] = moduleRegistry,
): boolean {
  const mod = moduleByPath(pathname, registry);
  if (!mod) return false;
  const rel = pathname.slice(mod.namespace.length) || '/';
  return mod.menu.some((item) => item.admin && matchRel(item.to, rel));
}

// ── util ─────────────────────────────────────────────────────────────────────

function joinPath(namespace: string, to: string): string {
  if (to === '/' || to === '') return namespace;
  return `${namespace}${to.startsWith('/') ? '' : '/'}${to}`;
}

/** Match tosco de rota relativa, tolerando segmentos `:param`. */
function matchRel(pattern: string, actual: string): boolean {
  const p = pattern.split('/').filter(Boolean);
  const a = actual.split('/').filter(Boolean);
  if (p.length !== a.length) return false;
  return p.every((seg, i) => seg.startsWith(':') || seg === a[i]);
}
