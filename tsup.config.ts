import { defineConfig } from 'tsup';

/**
 * Lib build para `@igreen/platform-shell`.
 *
 * - Dupla saída ESM + CJS (o host VO é ESM; consumidores CJS ainda funcionam).
 * - `.d.ts` gerado (é o contrato tipado que host e remotes compartilham).
 * - React / ReactDOM / TanStack Query ficam EXTERNOS: são `peerDependencies` e,
 *   em runtime, `shared: { singleton: true }` no Module Federation. Empacotá-los
 *   aqui duplicaria React e quebraria o cruzamento de Context (ver spike-federation.md §4).
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  external: ['react', 'react-dom', 'react/jsx-runtime', '@tanstack/react-query'],
});
