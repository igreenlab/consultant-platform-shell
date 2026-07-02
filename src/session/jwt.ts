/**
 * Decodificação (NÃO verificação) do VO session token.
 *
 * Decisão α (`01-decisoes.md` Rodada 3): **o VO JWT é a identidade universal**.
 * O token é opaco/HS256, issuer `igreen-virtual-office`, e carrega `sub =
 * idconsultor`. A ASSINATURA é verificada no backend (cada API de módulo passa
 * a aceitar o VO JWT); o browser só decodifica o payload para exibir/rotear a
 * identidade. Nunca confie neste decode para autorização — só para UI/escopo de
 * exibição. O escopo de dados real vem sempre do token verificado no servidor
 * (INVARIANTE #1 do VO).
 */

export interface VoJwtClaims {
  /** idconsultor, como string (padrão JWT). */
  sub?: string;
  email?: string;
  iss?: string;
  iat?: number;
  exp?: number;
  [k: string]: unknown;
}

function b64urlDecode(segment: string): string | null {
  try {
    const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
    let binary: string;
    if (typeof atob === 'function') {
      binary = atob(padded);
    } else {
      // Fallback Node sem atob global.
      binary = (globalThis as { Buffer?: { from(s: string, e: string): { toString(e: string): string } } })
        .Buffer!.from(padded, 'base64')
        .toString('binary');
    }
    // Reinterpreta como UTF-8 (claims podem ter acento em `email`/`nome`).
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** Decodifica o payload do VO JWT. Retorna `null` se malformado. */
export function decodeVoJwt(token: string | null | undefined): VoJwtClaims | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const json = b64urlDecode(parts[1]!);
  if (!json) return null;
  try {
    return JSON.parse(json) as VoJwtClaims;
  } catch {
    return null;
  }
}

/** Extrai `idconsultor` (= `sub`) do VO JWT. Núcleo da decisão α. */
export function idconsultorFromToken(
  token: string | null | undefined,
): number | null {
  const sub = decodeVoJwt(token)?.sub;
  if (sub == null) return null;
  const n = Number(sub);
  return Number.isFinite(n) ? n : null;
}

/** `true` se o `exp` do token já passou (skew de 0s). Útil pra evitar fetch fadado. */
export function isTokenExpired(token: string | null | undefined): boolean {
  const exp = decodeVoJwt(token)?.exp;
  if (typeof exp !== 'number') return false; // sem exp legível => deixa o backend decidir
  return Date.now() >= exp * 1000;
}
