import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeVoJwt, idconsultorFromToken, isTokenExpired } from '../dist/index.js';

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

test('decodeVoJwt reads the payload (sub = idconsultor, decisão α)', () => {
  const token = makeToken({ sub: '12345', email: 'a@b.c', iss: 'igreen-virtual-office' });
  const claims = decodeVoJwt(token);
  assert.equal(claims?.sub, '12345');
  assert.equal(claims?.iss, 'igreen-virtual-office');
});

test('idconsultorFromToken returns the numeric sub', () => {
  assert.equal(idconsultorFromToken(makeToken({ sub: '42' })), 42);
});

test('decode is null-safe for garbage / null', () => {
  assert.equal(decodeVoJwt(null), null);
  assert.equal(decodeVoJwt('not-a-jwt'), null);
  assert.equal(idconsultorFromToken(undefined), null);
  assert.equal(idconsultorFromToken(makeToken({ email: 'no-sub@x.com' })), null);
});

test('isTokenExpired respects exp', () => {
  const past = makeToken({ sub: '1', exp: Math.floor(Date.now() / 1000) - 60 });
  const future = makeToken({ sub: '1', exp: Math.floor(Date.now() / 1000) + 3600 });
  assert.equal(isTokenExpired(past), true);
  assert.equal(isTokenExpired(future), false);
  assert.equal(isTokenExpired(makeToken({ sub: '1' })), false); // sem exp legível
});
