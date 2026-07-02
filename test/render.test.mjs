import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Polyfill mínimo de Web Storage + window (SSR/node não tem DOM) ────────────
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
  addEventListener: () => {},
  removeEventListener: () => {},
};
globalThis.localStorage = localStorage;
globalThis.sessionStorage = sessionStorage;

// Semeia a sessão ANTES de montar (como se o usuário já estivesse logado no VO).
function b64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
const TOKEN = `${b64url({ alg: 'HS256' })}.${b64url({ sub: '777', iss: 'igreen-virtual-office' })}.sig`;
localStorage.setItem('vo_session_token', TOKEN);

// Import DEPOIS de polyfillar (o módulo lê window/localStorage em call-time de todo modo).
const {
  SessionProvider,
  useSession,
  ModuleSlot,
  useHostContext,
  useIsInVOShell,
} = await import('../dist/index.js');

function SessionConsumer() {
  const s = useSession();
  return React.createElement(
    'span',
    { id: 'session' },
    `token=${s.token ? 'set' : 'null'};idconsultor=${s.idconsultor}`,
  );
}

// Simula o que um REMOTE faz: lê o host context e suprime sua própria nav.
function RemoteRoot() {
  const host = useHostContext();
  const inVO = useIsInVOShell();
  const session = useSession(); // sessão cruzando a "fronteira" (mesmo Context object)
  return React.createElement(
    'div',
    { id: 'remote' },
    `shell=${host.shell};module=${host.module};hideOwnNav=${inVO};remoteSeesConsultor=${session.idconsultor}`,
  );
}

test('SessionProvider exposes decoded idconsultor synchronously (α) and ModuleSlot passes host context to a "remote"', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = React.createElement(
    QueryClientProvider,
    { client: qc },
    React.createElement(
      SessionProvider,
      { fetchConsultant: async () => ({ idconsultor: 777, nome: 'Fulano' }) },
      React.createElement(SessionConsumer),
      React.createElement(
        ModuleSlot,
        { module: 'rankings' },
        React.createElement(RemoteRoot),
      ),
    ),
  );

  const html = renderToStaticMarkup(tree);

  // Sessão única lida no host:
  assert.match(html, /token=set;idconsultor=777/);
  // O "remote" (dentro do ModuleSlot) vê shell=vo, o módulo, e a MESMA sessão:
  assert.match(html, /shell=vo;module=rankings;hideOwnNav=true;remoteSeesConsultor=777/);
});

test('useHostContext defaults to standalone outside a ModuleSlot', () => {
  const html = renderToStaticMarkup(React.createElement(StandaloneProbe));
  assert.match(html, /shell=standalone/);
});
function StandaloneProbe() {
  const host = useHostContext();
  return React.createElement('span', null, `shell=${host.shell}`);
}
