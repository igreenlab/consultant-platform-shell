/** Perfil do consultor logado — espelha `GET /v1/consultant` do VO. */
export interface Consultant {
  idconsultor: number;
  nome: string;
  email: string;
  cpf: string;
  cnpj: string;
  graduacao: string;
}

/** Valor exposto por `useSession()` — lido por host E remotes (via singleton). */
export interface SessionValue {
  /** VO session token cru (`vo_session_token`). Bearer para as APIs. */
  token: string | null;
  /** `idconsultor` decodificado do `sub` do VO JWT (decisão α), síncrono. */
  idconsultor: number | null;
  /** Perfil carregado da API (`['consultant', token]`); `null` enquanto carrega. */
  consultant: Consultant | null;
  /** `true` enquanto o perfil do consultor está sendo buscado. */
  isLoading: boolean;
  /** Grava o token e dispara o fetch do consultor. */
  login: (token: string, opts?: { keepConnected?: boolean }) => void;
  /** Limpa a sessão. O host decide para onde navegar via `onLogout`. */
  logout: () => void;
}
