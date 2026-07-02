import { Component, Suspense, type ReactNode } from 'react';
import { HostProvider } from './HostContext';
import { moduleById } from '../registry/moduleRegistry';
import type { ModuleId, ModuleManifest } from '../registry/types';

/**
 * ModuleSlot — monta a subárvore `<Routes>`-less de um remote federado sob um
 * namespace de rota, espelhando como o VO monta filhos lazy sob o `<Outlet/>` do
 * AppLayout (`ui/src/routes/router.tsx` filhos + `AppLayout.tsx:254`).
 *
 * O host usa numa rota splat dentro dos filhos do AppLayout:
 *
 *   const RankingsRoutes = lazy(() => import('rankings/Routes'));
 *   { path: 'rankings/*', element: (
 *       <Suspense fallback={<Loading/>}>
 *         <ModuleSlot module="rankings"><RankingsRoutes /></ModuleSlot>
 *       </Suspense>
 *   ) }
 *
 * Responsabilidades:
 *  - prover `HostContext={{ shell:'vo', module, namespace }}` (D6 §2c-2) → o remote
 *    suprime sua própria nav;
 *  - `<Suspense>` local (carregamento do chunk MF) + Error Boundary (remote fora
 *    do ar não derruba o host — sidebar/topbar do VO persistem);
 *  - NÃO cria layout novo: já renderiza dentro do `<main>` do AppLayout.
 *
 * Não depende de react-router de propósito: o host é dono do history e o
 * `basename`/splat é configurado na rota do host, não aqui.
 */

export interface ModuleSlotProps {
  /** Módulo federado sendo montado. Resolve namespace no registry. */
  module: ModuleId;
  /** A subárvore do remote (o componente lazy importado de `<module>/Routes`). */
  children: ReactNode;
  /** Override do registry, se o host não usar o `moduleRegistry` padrão. */
  manifest?: ModuleManifest;
  /** Fallback do Suspense (carregando o chunk do remote). */
  fallback?: ReactNode;
  /** Fallback quando o remote falha ao carregar/renderizar. */
  errorFallback?: (error: Error) => ReactNode;
}

interface BoundaryProps {
  children: ReactNode;
  fallback: (error: Error) => ReactNode;
}
interface BoundaryState {
  error: Error | null;
}

class ModuleErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override render(): ReactNode {
    if (this.state.error) return this.props.fallback(this.state.error);
    return this.props.children;
  }
}

function DefaultFallback() {
  return null;
}

function defaultErrorFallback(error: Error): ReactNode {
  return (
    <div role="alert" style={{ padding: 24 }}>
      Não foi possível carregar este módulo. {error.message}
    </div>
  );
}

export function ModuleSlot({
  module,
  children,
  manifest,
  fallback,
  errorFallback = defaultErrorFallback,
}: ModuleSlotProps) {
  const resolved = manifest ?? moduleById(module);
  const namespace = resolved?.namespace;

  return (
    <HostProvider value={{ shell: 'vo', module, namespace }}>
      <ModuleErrorBoundary fallback={errorFallback}>
        <Suspense fallback={fallback ?? <DefaultFallback />}>{children}</Suspense>
      </ModuleErrorBoundary>
    </HostProvider>
  );
}
