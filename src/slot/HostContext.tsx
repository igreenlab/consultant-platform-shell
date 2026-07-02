import { createContext, useContext, type ReactNode } from 'react';
import type { ModuleId } from '../registry/types';

/**
 * HostContext — sinaliza ao remote QUEM o está renderizando (D6 §2c-2).
 *
 * Também mora neste pacote singleton, então cruza a fronteira do MF junto com a
 * sessão. Um remote lê `useHostContext()` e:
 *  - `shell:'vo'`      → SUPRIME sua própria navegação global (hub/sidebar/"voltar")
 *                        porque os menus concentram na camada do VO;
 *  - `shell:'standalone'` (default, sem provider) → renderiza sua nav normalmente.
 */
export interface HostContextValue {
  shell: 'vo' | 'standalone';
  /** Módulo sendo montado (quando `shell:'vo'`). */
  module?: ModuleId;
  /** Namespace de rota sob o qual o módulo está montado (ex.: '/rankings'). */
  namespace?: string;
}

const DEFAULT_HOST_CONTEXT: HostContextValue = { shell: 'standalone' };

const HostContext = createContext<HostContextValue>(DEFAULT_HOST_CONTEXT);

export interface HostProviderProps {
  value: HostContextValue;
  children: ReactNode;
}

export function HostProvider({ value, children }: HostProviderProps) {
  return <HostContext.Provider value={value}>{children}</HostContext.Provider>;
}

/** Lê o contexto do host. Fora de um `<ModuleSlot>` retorna `{ shell:'standalone' }`. */
export function useHostContext(): HostContextValue {
  return useContext(HostContext);
}

/** Açúcar: `true` quando o módulo está sendo renderizado dentro do VO. */
export function useIsInVOShell(): boolean {
  return useHostContext().shell === 'vo';
}
