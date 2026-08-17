/**
 * Guardas de segurança da sessão: origem do `apiBase` e expiração do token.
 *
 * Cada teste aqui falha na versão anterior do guard — são regressões que já
 * aconteceram, não hipóteses.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const HOST_ORIGIN = 'https://escritorio.igreenenergy.com.br';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  };
}
const localStorage = memoryStorage();
const sessionStorage = memoryStorage();
globalThis.window = {
  localStorage,
  sessionStorage,
  // O guard de origem compara contra isto — sem `location` ele não tem o que checar.
  location: { origin: HOST_ORIGIN, href: `${HOST_ORIGIN}/` },
  addEventListener: () => {},
  removeEventListener: () => {},
};
globalThis.localStorage = localStorage;
globalThis.sessionStorage = sessionStorage;

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function makeToken(payload) {
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.signature`;
}

const VALID_TOKEN = makeToken({
  sub: '777',
  iss: 'igreen-virtual-office',
  exp: Math.floor(Date.now() / 1000) + 3600,
});
localStorage.setItem('vo_session_token', VALID_TOKEN);

const { SessionProvider, isAdminRoute, isTokenExpired } = await import(
  '../dist/index.js'
);

function renderWithApiBase(apiBase) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(
        SessionProvider,
        { apiBase },
        React.createElement('span', null, 'ok'),
      ),
    ),
  );
}

// ── apiBase: o Bearer token não pode sair do host ────────────────────────────

test('apiBase same-origin (relativo ou absoluto do host) é aceito', () => {
  for (const base of ['', '/api', 'api/v1', `${HOST_ORIGIN}/api`]) {
    assert.doesNotThrow(() => renderWithApiBase(base), `apiBase=${base}`);
  }
});

test('apiBase de outra origem é recusado', () => {
  assert.throws(() => renderWithApiBase('https://evil.example/api'), /outra origem/);
});

test('apiBase protocol-relative NÃO passa pelo guard (//evil, /\\evil)', () => {
  // Ambos começam com "/" — o guard antigo os tratava como relativos e o token
  // do consultor iria pra evil.example na primeira chamada.
  assert.throws(() => renderWithApiBase('//evil.example'), /outra origem/);
  assert.throws(() => renderWithApiBase('//evil.example/api'), /outra origem/);
  assert.throws(() => renderWithApiBase('/\\evil.example'), /outra origem/);
});

test('as URLs do teste realmente resolvem pra fora (a premissa do bug)', () => {
  assert.equal(new URL('//evil.example', HOST_ORIGIN).origin, 'https://evil.example');
  assert.equal(new URL('/\\evil.example', HOST_ORIGIN).origin, 'https://evil.example');
  assert.equal(new URL('/api', HOST_ORIGIN).origin, HOST_ORIGIN);
});

// ── expiração ────────────────────────────────────────────────────────────────

test('isTokenExpired: exp no passado expira, no futuro não', () => {
  const past = makeToken({ sub: '1', exp: Math.floor(Date.now() / 1000) - 1 });
  const future = makeToken({ sub: '1', exp: Math.floor(Date.now() / 1000) + 60 });
  assert.equal(isTokenExpired(past), true);
  assert.equal(isTokenExpired(future), false);
  assert.equal(isTokenExpired(makeToken({ sub: '1' })), false); // sem exp: backend decide
});

test('provider monta com token expirado no storage sem estourar', () => {
  // NOTA: `renderToStaticMarkup` não roda `useEffect` — este teste cobre só a
  // montagem. O logout proativo (efeito + timer no `exp`) não é coberto por
  // teste automatizado: o repo não tem runner com DOM/act.
  localStorage.setItem(
    'vo_session_token',
    makeToken({ sub: '777', exp: Math.floor(Date.now() / 1000) - 10 }),
  );
  assert.doesNotThrow(() => renderWithApiBase('/api'));
  localStorage.setItem('vo_session_token', VALID_TOKEN);
});

// ── rotas admin ──────────────────────────────────────────────────────────────

test('isAdminRoute cobre sub-rotas da rota admin, não só o match exato', () => {
  assert.equal(isAdminRoute('/creators/admin-moderacao'), true);
  assert.equal(isAdminRoute('/creators/admin-moderacao/caso/42'), true);
  assert.equal(isAdminRoute('/rankings/acionistas/detalhe'), true);
  assert.equal(isAdminRoute('/rankings/ranking-cotas/2026/q3'), true);
});

test('isAdminRoute não vira curinga: rota normal segue liberada', () => {
  assert.equal(isAdminRoute('/creators/videos'), false);
  assert.equal(isAdminRoute('/creators/'), false);
  assert.equal(isAdminRoute('/creators'), false);
  assert.equal(isAdminRoute('/rankings/mapa-cidades'), false);
  assert.equal(isAdminRoute('/store/carrinho'), false);
  assert.equal(isAdminRoute('/fora-de-qualquer-modulo'), false);
});
