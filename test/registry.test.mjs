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

test('registry has the 3 target modules with namespaces', () => {
  const ids = moduleRegistry.map((m) => m.id).sort();
  assert.deepEqual(ids, ['academy', 'eventos', 'rankings']);
  assert.equal(moduleByPath('/rankings/mapa-cidades')?.id, 'rankings');
  assert.equal(moduleByPath('/academy')?.id, 'academy');
  assert.equal(moduleByPath('/unknown'), undefined);
});

test('enabledModules honors the feature-flag (eventos disabled)', () => {
  const ids = enabledModules().map((m) => m.id);
  assert.ok(ids.includes('rankings'));
  assert.ok(ids.includes('academy'));
  assert.ok(!ids.includes('eventos')); // enabled:false → fica de fora
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
  // disabled module (eventos) contributes nothing
  assert.ok(!tos.some((t) => t.startsWith('/eventos/')));
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
});
