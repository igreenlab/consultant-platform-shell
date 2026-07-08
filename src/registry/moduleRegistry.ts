import type {
  ModuleId,
  ModuleManifest,
  VOModule,
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
    label: 'Rankings',
    icon: 'Trophy',
    order: 1,
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
    label: 'Academy',
    icon: 'GraduationCap',
    order: 2,
    namespace: '/academy',
    remoteEntry: '/academy/assets/remoteEntry.js',
    expose: './Routes',
    session: 'firebase-bridge', // SSO: VO emite custom token Firebase (docs/migration/academy-sso.md no VO)
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
    label: 'Eventos',
    icon: 'Calendar',
    order: 3,
    namespace: '/eventos',
    remoteEntry: '/eventos/assets/remoteEntry.js',
    expose: './Routes',
    session: 'vo-jwt', // ponte vo-jwt no backend do eventos (auth.js) — pronta
    enabled: true, // backend re-plataformado (Postgres) + cutover concluído 2026-07
    menu: [
      {
        label: 'Agenda',
        icon: 'Calendar',
        to: '/calendario',
        group: 'Eventos',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      {
        label: 'Meus Convites',
        icon: 'Ticket',
        to: '/meus-convites',
        group: 'Eventos',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      {
        label: 'Convites na Equipe',
        icon: 'Users',
        to: '/convites-equipe',
        group: 'Eventos',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      // Admin do módulo: FORA da sidebar do VO (acesso admin fica no standalone
      // eventos.igreen). Sob o shell o licenciado só vê agenda + seus convites.
      {
        label: 'Eventos',
        icon: 'CalendarCog',
        to: '/admin/eventos',
        group: 'Eventos',
        surfaceInVOSidebar: false,
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

/**
 * Módulos habilitados resolvidos para a RAIL do VO (1 ícone por módulo — menu de
 * 2 colunas). Ordenados por `order` asc; empate/ausente mantém a ordem do
 * registry. Módulos `enabled:false` NÃO entram (rollout via feature-flag).
 */
export function voModules(
  registry: ModuleManifest[] = moduleRegistry,
): VOModule[] {
  return enabledModules(registry)
    .map((m, i) => ({ m, i }))
    .sort((a, b) => (a.m.order ?? a.i) - (b.m.order ?? b.i) || a.i - b.i)
    .map<VOModule>(({ m }) => ({
      id: m.id,
      label: m.label,
      icon: m.icon,
      namespace: m.namespace,
    }));
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
