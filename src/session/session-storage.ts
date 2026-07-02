/**
 * Armazenamento do token de sessão do Virtual Office.
 *
 * Porte fiel de `ui/src/auth/voSession.ts` do host VO — mesma chave
 * (`vo_session_token`), mesma política de storage e o mesmo `subscribe`.
 * Vive DENTRO deste pacote (e não no app) porque `@igreen/platform-shell` é o
 * `shared: { singleton: true }` do Module Federation: host e remotes leem a
 * MESMA sessão a partir daqui, sem cada módulo reimplementar storage.
 *
 * - "manter conectado" => localStorage (persiste entre abas/sessões)
 * - caso contrário      => sessionStorage (some ao fechar a aba)
 *
 * Sem cookies. Um único `subscribe` notifica mudanças (inclusive entre abas via
 * o evento `storage`). Todos os acessos a Web Storage / window são guardados
 * para o pacote também rodar em ambiente sem DOM (SSR / teste em node).
 */

export const TOKEN_KEY = 'vo_session_token';

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) l();
}

function getStorage(kind: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function safeGet(storage: Storage | null): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Lê o token: prioriza localStorage (keepConnected), depois sessionStorage. */
export function getToken(): string | null {
  return safeGet(getStorage('local')) ?? safeGet(getStorage('session'));
}

export function hasSession(): boolean {
  return !!getToken();
}

/** Grava o token no storage adequado e limpa o outro para não duplicar sessão. */
export function setToken(
  token: string,
  opts: { keepConnected?: boolean } = {},
): void {
  const { keepConnected = false } = opts;
  const local = getStorage('local');
  const session = getStorage('session');
  try {
    if (keepConnected) {
      local?.setItem(TOKEN_KEY, token);
      session?.removeItem(TOKEN_KEY);
    } else {
      session?.setItem(TOKEN_KEY, token);
      local?.removeItem(TOKEN_KEY);
    }
  } catch {
    // storage indisponível (modo privado etc.) — ignora silenciosamente.
  }
  notify();
}

/** Remove o token de ambos os storages. */
export function clear(): void {
  try {
    getStorage('local')?.removeItem(TOKEN_KEY);
    getStorage('session')?.removeItem(TOKEN_KEY);
  } catch {
    // ignora
  }
  notify();
}

/**
 * Inscreve um listener para mudanças de sessão. Reage a `setToken`/`clear`
 * locais e ao evento `storage` (mudanças vindas de outra aba). Retorna cleanup.
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);

  const onStorage =
    typeof window === 'undefined'
      ? null
      : (e: StorageEvent) => {
          if (e.key === TOKEN_KEY || e.key === null) listener();
        };
  if (onStorage) window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    if (onStorage) window.removeEventListener('storage', onStorage);
  };
}

/** Fachada equivalente à `voSession` do host. */
export const voSession = {
  TOKEN_KEY,
  getToken,
  hasSession,
  setToken,
  clear,
  subscribe,
};
