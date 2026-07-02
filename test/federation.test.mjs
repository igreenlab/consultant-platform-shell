import test from 'node:test';
import assert from 'node:assert/strict';

import {
  federationShared,
  federationDefaults,
  federationBuild,
  federationBuildTarget,
} from '../dist/index.js';

test('federationShared: React/ReactDOM are STRICT singletons (the critical barrier)', () => {
  const shared = federationShared();
  for (const pkg of ['react', 'react-dom']) {
    assert.equal(shared[pkg].singleton, true, `${pkg} must be singleton`);
    assert.equal(shared[pkg].strictVersion, true, `${pkg} must be strictVersion`);
    assert.equal(shared[pkg].requiredVersion, '^19.2.0');
  }
});

test('federationShared: THIS package is a singleton (so Context crosses the boundary)', () => {
  const shared = federationShared();
  assert.equal(shared['@igreen/platform-shell'].singleton, true);
});

test('build target is chrome89 (top-level await)', () => {
  assert.equal(federationBuildTarget, 'chrome89');
  assert.equal(federationBuild.target, 'chrome89');
  assert.equal(federationDefaults().build.target, 'chrome89');
});

test('extraSingletons merge in (e.g. DS chain / react-query / router)', () => {
  const shared = federationShared({
    reactVersion: '^19.0.0',
    extraSingletons: {
      'react-router-dom': { singleton: true, requiredVersion: '^7.0.0' },
      '@tanstack/react-query': { singleton: true },
    },
  });
  assert.equal(shared.react.requiredVersion, '^19.0.0');
  assert.equal(shared['react-router-dom'].requiredVersion, '^7.0.0');
  assert.equal(shared['@tanstack/react-query'].singleton, true);
});
