import type {
  ModuleId,
  ModuleManifest,
  VOModule,
  VOSidebarGroup,
  VOSidebarItem,
} from './types';

/**
 * Registry de referência com os módulos-alvo (rankings/academy/eventos +
 * creators em rollout). Os itens de menu vêm das
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
      {
        // `Sparkles` já está no MODULE_ICONS do host (ui/src/layout/AppLayout.tsx);
        // nome fora daquele mapa cai no fallback `Trophy`.
        label: 'Ranking 3 Estrelas',
        icon: 'Sparkles',
        to: '/tres-estrelas',
        group: 'Rankings',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      {
        label: 'Cruzeiro Gusttavo Lima',
        icon: 'Ship',
        to: '/cruzeiro-gusttavo-lima',
        group: 'Campanhas',
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
      // Lista/gestão de eventos (EventsManagerPage). Volta pra sidebar do VO (pedido
      // do dono); os botões de AÇÃO admin/acionista DENTRO dela seguem ocultos sob o
      // shell ({!inShell}) — só a lista/CRUD de eventos fica acessível.
      {
        label: 'Lista de Eventos',
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
  {
    id: 'creators',
    label: 'Creators',
    icon: 'Rocket', // mesmo ícone do contexto no standalone (creator-hub App.tsx)
    order: 4,
    namespace: '/creators',
    remoteEntry: '/creators/assets/remoteEntry.js',
    expose: './Routes',
    // SSO: a API do Creator Hub (terceiro — Mix Ideias) já troca Firebase ID
    // token por sessão própria em POST /api/v1/auth/igreen — mesma ponte do
    // Academy. Confirmar o project ID com a Mix Ideias (Fase 0); se divergir,
    // plano B = 'vo-jwt' (backend deles validar o VO JWT).
    session: 'firebase-bridge',
    // Ligado junto do bake-in do remote no vo-ui (F3, 2026-07). Rollout por
    // ambiente segue no ponteiro do submódulo do host: develop (dev-escritorio)
    // primeiro; prod só quando o main do VO bumpar o submódulo (prod/ui/deploy.sh
    // já builda o creators-remote:prod desde o mesmo F3).
    enabled: true,
    menu: [
      {
        label: 'Painel',
        icon: 'LayoutDashboard',
        to: '/',
        group: 'Creators',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      {
        label: 'Meus vídeos',
        icon: 'Video',
        to: '/videos',
        group: 'Creators',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      {
        label: 'Ranking',
        icon: 'Trophy',
        to: '/ranking',
        group: 'Creators',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      {
        label: 'Academy',
        icon: 'GraduationCap',
        to: '/academy',
        group: 'Creators',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      {
        label: 'Estúdio de IA',
        icon: 'Sparkles',
        to: '/ia',
        group: 'Creators',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      {
        label: 'Regras',
        icon: 'ClipboardList',
        to: '/regras',
        group: 'Creators',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      {
        label: 'Minha conta',
        icon: 'UserCog',
        to: '/conta',
        group: 'Creators',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      {
        label: 'Ajuda',
        icon: 'CircleHelp',
        to: '/ajuda',
        group: 'Creators',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      // Atalhos da conta (no standalone vivem no user-menu do AppShell, não na
      // sidebar). Existem como rota, sem item de menu no VO.
      {
        label: 'Minhas redes',
        icon: 'AtSign',
        to: '/redes',
        group: 'Minha conta',
        surfaceInVOSidebar: false,
        voTriggerable: false,
      },
      {
        label: 'Dados de pagamento',
        icon: 'CreditCard',
        to: '/pagamento',
        group: 'Minha conta',
        surfaceInVOSidebar: false,
        voTriggerable: false,
      },
      {
        label: 'Conexões',
        icon: 'Link2',
        to: '/conexoes',
        group: 'Minha conta',
        surfaceInVOSidebar: false,
        voTriggerable: false,
      },
      {
        label: 'Segurança',
        icon: 'ShieldCheck',
        to: '/seguranca',
        group: 'Minha conta',
        surfaceInVOSidebar: false,
        voTriggerable: false,
      },
      // Admin — NÃO exposto no VO (2 barreiras: fora da sidebar + fora do
      // expose './Routes'). Gestão segue no standalone (creators.igreenenergy…).
      {
        label: 'Moderação',
        icon: 'Lock',
        to: '/admin-moderacao',
        group: 'Administração',
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true,
      },
      {
        label: 'Campanhas',
        icon: 'Lock',
        to: '/admin-campanhas',
        group: 'Administração',
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true,
      },
      {
        label: 'Regras (admin)',
        icon: 'Lock',
        to: '/admin-regras',
        group: 'Administração',
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true,
      },
      {
        label: 'Usuários',
        icon: 'Lock',
        to: '/admin-usuarios',
        group: 'Administração',
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true,
      },
      {
        label: 'Laboratório',
        icon: 'Lock',
        to: '/admin-laboratorio',
        group: 'Administração',
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true,
      },
      {
        label: 'Rede neural',
        icon: 'Lock',
        to: '/admin-rede',
        group: 'Administração',
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true,
      },
      {
        label: 'Financeiro',
        icon: 'Lock',
        to: '/admin-financeiro',
        group: 'Administração',
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true,
      },
      {
        label: 'Pagamentos',
        icon: 'Lock',
        to: '/admin-pagamentos',
        group: 'Administração',
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true,
      },
      {
        label: 'Configuração',
        icon: 'Lock',
        to: '/admin-config',
        group: 'Administração',
        surfaceInVOSidebar: false,
        voTriggerable: false,
        admin: true,
      },
    ],
  },
  {
    id: 'store',
    label: 'Loja',
    icon: 'Store',
    order: 5,
    namespace: '/store',
    remoteEntry: '/store/assets/remoteEntry.js',
    expose: './Routes',
    // SSO: a api-igreen-store JÁ troca um JWT iGreen pelo cookie de sessão em
    // POST /auth/session — mas exige o MESMO segredo e a MESMA audience
    // (aud=igreen-store) que o login dela emite, então o voSession não serve
    // direto. A ponte é 'vo-jwt': a api-store valida o JWT do VO e emite o
    // token dela (F4), mesmo desenho do eventos.
    session: 'vo-jwt',
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
        label: 'Loja',
        icon: 'Store',
        to: '/',
        group: 'Loja',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      {
        label: 'Carrinho',
        icon: 'ShoppingCart',
        to: '/carrinho',
        group: 'Loja',
        surfaceInVOSidebar: true,
        voTriggerable: true,
      },
      {
        label: 'Meus pedidos',
        icon: 'Package',
        to: '/pedidos',
        group: 'Loja',
        surfaceInVOSidebar: true,
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

/**
 * Match tosco de rota relativa, tolerando segmentos `:param`.
 *
 * Casa por PREFIXO de segmentos, não por igualdade: uma rota admin cobre suas
 * sub-rotas (`/admin-moderacao/caso/42` é tão admin quanto `/admin-moderacao`).
 * Com igualdade exata, `isAdminRoute` respondia `false` pra qualquer deep-link
 * abaixo da rota admin — quem usasse esse helper como guard deixaria passar.
 */
function matchRel(pattern: string, actual: string): boolean {
  const p = pattern.split('/').filter(Boolean);
  const a = actual.split('/').filter(Boolean);
  // Pattern `/` (raiz do módulo) casa só com a raiz — senão viraria curinga.
  if (p.length === 0) return a.length === 0;
  if (p.length > a.length) return false;
  return p.every((seg, i) => seg.startsWith(':') || seg === a[i]);
}
