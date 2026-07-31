import test from 'node:test';
import assert from 'node:assert/strict';

import {
  moduleRegistry,
  enabledModules,
  moduleByPath,
  voSidebarItems,
  voSidebarGroups,
  voTriggerableRoutes,
  isAdminRoute,
} from '../dist/index.js';

test('registry has the 4 target modules with namespaces', () => {
  const ids = moduleRegistry.map((m) => m.id).sort();
  assert.deepEqual(ids, ['academy', 'creators', 'eventos', 'rankings']);
  assert.equal(moduleByPath('/rankings/mapa-cidades')?.id, 'rankings');
  assert.equal(moduleByPath('/academy')?.id, 'academy');
  assert.equal(moduleByPath('/creators/videos')?.id, 'creators');
  assert.equal(moduleByPath('/unknown'), undefined);
});

test('enabledModules honors the feature-flag (creators disabled until bake-in)', () => {
  const ids = enabledModules().map((m) => m.id);
  assert.ok(ids.includes('rankings'));
  assert.ok(ids.includes('academy'));
  assert.ok(ids.includes('eventos')); // cutover concluído 2026-07 → ligado
  assert.ok(!ids.includes('creators')); // enabled:false → fica de fora até o F3
});

test('D6: voSidebarItems excludes admin + honors surfaceInVOSidebar, to is absolute', () => {
  const items = voSidebarItems();
  const tos = items.map((i) => i.to);
  // admin routes NEVER surface
  assert.ok(!tos.includes('/rankings/ranking-cotas'));
  assert.ok(!tos.includes('/rankings/acionistas'));
  // surfaceable rankings items ARE present, with namespace-prefixed `to`
  assert.ok(tos.includes('/rankings/mapa-cidades'));
  assert.ok(tos.includes('/rankings/ranking-verticais'));
  // disabled module (creators) contributes nothing
  assert.ok(!tos.some((t) => t.startsWith('/creators/')));
  // no admin item leaked
  assert.ok(items.every((i) => i.module !== undefined));
});

test('D6: voSidebarGroups groups items by `group`', () => {
  const groups = voSidebarGroups();
  const rankings = groups.find((g) => g.group === 'Rankings');
  assert.ok(rankings);
  assert.equal(rankings.items.length, 3);
});

test('D6: voTriggerableRoutes = deep-linkable routes, admin excluded', () => {
  const routes = voTriggerableRoutes().map((r) => r.to);
  assert.ok(routes.includes('/rankings/eventos'));
  assert.ok(!routes.includes('/rankings/acionistas'));
});

test('D6: isAdminRoute flags admin namespaces (expose barrier)', () => {
  assert.equal(isAdminRoute('/rankings/acionistas'), true);
  assert.equal(isAdminRoute('/rankings/mapa-cidades'), false);
  // creators: admin do módulo NUNCA exposto no VO (2 barreiras)
  assert.equal(isAdminRoute('/creators/admin-moderacao'), true);
  assert.equal(isAdminRoute('/creators/videos'), false);
});

test('creators manifest: contrato de federação (namespace/expose/session)', () => {
  const creators = moduleRegistry.find((m) => m.id === 'creators');
  assert.ok(creators);
  assert.equal(creators.namespace, '/creators');
  assert.equal(creators.remoteEntry, '/creators/assets/remoteEntry.js');
  assert.equal(creators.expose, './Routes');
  assert.equal(creators.session, 'firebase-bridge');
  // itens de sidebar (surfaceable, não-admin) = as 8 telas do criador
  const surfaceable = creators.menu.filter((i) => i.surfaceInVOSidebar && !i.admin);
  assert.equal(surfaceable.length, 8);
});
