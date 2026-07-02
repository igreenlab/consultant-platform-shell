/**
 * `federationShared` — a lista canônica de `shared` (singletons) para o
 * `@module-federation/vite`, validada pelo spike (`spike-federation.md` §2/§4/§6).
 *
 * Regra dura do spike: React singleton NÃO basta para o Context cruzar a
 * fronteira — o OBJETO Context precisa ser o mesmo dos dois lados, então o pacote
 * que o carrega (`@igreen/platform-shell`) também é `singleton: true`. Este
 * helper devolve exatamente:
 *   - `react` / `react-dom` como singleton ESTRITO;
 *   - `@igreen/platform-shell` como singleton (carrega SessionContext + HostContext);
 *   - `build.target: 'chrome89'` (o runtime do MF usa top-level await).
 *
 * Host e TODOS os remotes usam o MESMO bloco. Extenda com `extraSingletons` para
 * a cadeia do Design System quando federar o DS (module-federation.md §2d).
 */

export interface SharedEntry {
  singleton?: boolean;
  strictVersion?: boolean;
  requiredVersion?: string;
}

export type SharedConfig = Record<string, SharedEntry>;

export interface FederationSharedOptions {
  /** `requiredVersion` de react/react-dom. Default `^19.2.0` (régua do host VO). */
  reactVersion?: string;
  /** `requiredVersion` do pacote shell. Default: sem trava (aceita a resolvida). */
  shellVersion?: string;
  /** Nome do pacote shell singleton. Default `@igreen/platform-shell`. */
  packageName?: string;
  /**
   * Singletons extras a mesclar (ex.: `@tanstack/react-query`, `react-router-dom`,
   * e a cadeia do Design System). Sobrescreve as entradas base por chave.
   */
  extraSingletons?: SharedConfig;
}

const DEFAULT_PACKAGE = '@igreen/platform-shell';
const DEFAULT_REACT_VERSION = '^19.2.0';

/** Alvo de build exigido pelo MF (top-level await). */
export const federationBuildTarget = 'chrome89' as const;

/** Bloco `build` pronto pra espalhar no `defineConfig` (host e remotes). */
export const federationBuild = { target: federationBuildTarget } as const;

/**
 * Retorna o mapa `shared` para passar ao `federation({ shared })`.
 * (React/ReactDOM singleton estrito + este pacote singleton + extras.)
 */
export function federationShared(
  opts: FederationSharedOptions = {},
): SharedConfig {
  const {
    reactVersion = DEFAULT_REACT_VERSION,
    shellVersion,
    packageName = DEFAULT_PACKAGE,
    extraSingletons = {},
  } = opts;

  const react: SharedEntry = {
    singleton: true,
    strictVersion: true,
    requiredVersion: reactVersion,
  };

  const base: SharedConfig = {
    react: { ...react },
    'react-dom': { ...react },
    [packageName]: {
      singleton: true,
      ...(shellVersion ? { requiredVersion: shellVersion } : {}),
    },
  };

  return { ...base, ...extraSingletons };
}

/**
 * Conveniência: `{ shared, build }` de uma vez, pronto pra compor o vite.config
 * do host e de cada remote.
 *
 *   import { federation } from '@module-federation/vite';
 *   import { federationShared, federationBuild } from '@igreen/platform-shell';
 *   // plugins: [ react(), federation({ name, remotes, shared: federationShared() }) ]
 *   // build: federationBuild
 */
export function federationDefaults(opts: FederationSharedOptions = {}): {
  shared: SharedConfig;
  build: { target: typeof federationBuildTarget };
} {
  return { shared: federationShared(opts), build: { ...federationBuild } };
}
