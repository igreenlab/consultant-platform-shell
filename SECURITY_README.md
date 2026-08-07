# Auditoria de Segurança — 2026-08-07

`@igreen/platform-shell` — pacote biblioteca (não é o app-shell/host em
si) que define o contrato de sessão + Module Federation consumido pelo
host real (`virtual-office`, outro repositório): `SessionProvider`/
`useSession`, `moduleRegistry`, `ModuleSlot`, `federationShared`. Autor:
Dario C Oliveira.

Sem segredo hardcoded (nem na árvore atual, nem no histórico), sem XSS
(`dangerouslySetInnerHTML`/`innerHTML`), sem `console.log` vazando
token/PII, URLs dos módulos remotos fixas no registry versionado (nunca
vindas de input do usuário/query string).

A maior parte dos achados desta revisão não é corrigível só a partir
deste repositório — são decisões estruturais de todo o Virtual Office
(armazenamento de token, sandboxing de Module Federation, fechamento do
SSO de terceiro) que precisam ser avaliadas junto com o repo do host e os
backends de cada módulo.

## Histórico de correções

| Item | Auditoria | Status no `main` |
|---|---|---|
| `isTokenExpired()` existia mas não era usado no próprio Provider | 2026-08-07 | ⏳ Aguardando merge de `security` |
| `apiBase` sem validação de origem no fetch default | 2026-08-07 | ⏳ Aguardando merge de `security` |
| Token em localStorage/sessionStorage sem isolamento entre módulos remotos | 2026-08-07 | 🟡 Pendência de arquitetura (VO todo) — ver Pendências |
| SSO Academy/Creators não fechado | 2026-08-07 | 🟡 Pendência de produto/arquitetura — ver Pendências |
| Módulos remotos sem SRI/hash, terceiro com confiança total | 2026-08-07 | 🟡 Pendência de arquitetura (host + CI/CD do terceiro) — ver Pendências |
| Nenhum guard de rota client-side neste pacote | 2026-08-07 | 🟡 Por design — delega ao host/backend, ver Pendências |
| CPF/CNPJ trafegando pro módulo de terceiro via singleton | 2026-08-07 | 🟡 Pendência de produto/jurídico (LGPD) — ver Pendências |

## Corrigido nesta revisão

### Baixo

- **`isTokenExpired()` exportado mas nunca usado no próprio
  `SessionProvider`** (`session/SessionProvider.tsx`): um token com `exp`
  no passado (restaurado do storage, ou trocado noutra aba) ainda
  disparava a query do consultor normalmente e só falhava quando o
  backend respondia erro — sem UX de expiração proativa. Adicionado um
  efeito que chama `logout()` assim que detecta token expirado, e a
  query deixa de disparar nesse caso (`enabled` agora também checa
  `!isTokenExpired(token)`).
- **`apiBase` sem validação de origem** (`SessionProvider.tsx`,
  `makeDefaultFetchConsultant`): o fetcher default envia o Bearer token
  pra `${apiBase}/v1/consultant` sem checar que `apiBase` é same-origin.
  Se algum host configurar `apiBase` incorretamente (apontando pra
  domínio externo por engano), o token vazaria pra terceiros na primeira
  chamada. Adicionada `assertSameOriginApiBase`, que lança um erro claro
  na construção do fetcher se `apiBase` resolver pra uma origem diferente
  da página — cenário de misconfiguration, sem exploração conhecida
  hoje, aplicado como hardening defensivo.

`dist/` (build committada de propósito, conforme `.gitignore` comentado —
consumidores git-dep recebem build pronto) foi regenerada nesta revisão
pra refletir as duas correções acima.

## Pendências antes de fechar

- [ ] **Alto — Token em localStorage/sessionStorage, sem isolamento entre
      módulos remotos** (`session/session-storage.ts`): decisão de
      arquitetura documentada ("sem cookies"), mas o risco fica
      amplificado pelo modelo de Module Federation — como
      `@igreen/platform-shell` é `singleton: true`, todo módulo remoto
      roda no mesmo contexto JS da página, sem sandbox de iframe. Um XSS
      ou pacote comprometido em qualquer módulo tem acesso direto a
      `window.localStorage`/`sessionStorage`. Mudar pra cookie httpOnly
      quebraria o modelo de Bearer token usado por todo o VO — decisão a
      tomar no nível do host, não deste pacote.
- [ ] **Alto — SSO Academy/Creators não fechado**: o próprio time já
      documenta no README que `academy` e `creators` (session:
      `firebase-bridge`) dependem de uma ponte SSO que "pede revisão
      humana", e `creators` depende de confirmar o project ID com um
      fornecedor terceiro (Mix Ideias), com plano B só "se divergir". A
      ponte de identidade entre o JWT do VO e o Firebase custom token
      desses módulos não está fechada/validada segundo a própria
      documentação do time.
- [ ] **Alto — Módulos remotos sem verificação de integridade (SRI/hash)**
      (`federation/federationShared.ts`, `registry/moduleRegistry.ts`):
      o runtime de Module Federation carrega e executa o `remoteEntry.js`
      sem checar hash (limitação do próprio ecossistema MF). Combinado
      com `singleton: true` de React/deste pacote, qualquer
      comprometimento do pipeline de build/deploy/CDN de qualquer um dos
      4 módulos — inclusive `creators`, operado por um terceiro (Mix
      Ideias), já `enabled: true` em produção — resulta em execução de
      código arbitrário com acesso total ao token de sessão e ao DOM do
      host. Mitigação real está fora deste pacote: CSP restritiva no
      host, controles de CI/CD e assinatura de build no módulo de
      terceiro, ou isolamento por iframe pra módulos não confiáveis.
- [ ] **Médio — Nenhum guard de rota client-side neste pacote**
      (`slot/ModuleSlot.tsx`): `ModuleSlot` monta a subárvore do remote
      incondicionalmente, sem checar `token`/`idconsultor` antes. Por
      design — a garantia real é o backend de cada módulo validar o JWT a
      cada chamada (INVARIANTE #1 do VO, documentado em `jwt.ts`) — mas
      significa que este pacote não oferece nenhuma rede de segurança
      própria. Precisa ser confirmado no repo do host (`virtual-office`)
      e nos backends de `academy`/`creators`/demais módulos.
- [ ] **Médio — CPF/CNPJ trafegando pro módulo de terceiro via singleton**
      (`session/types.ts`, campo `Consultant.cpf`/`cnpj`): dado pessoal
      sob LGPD exposto via `useSession()` a todo módulo federado,
      incluindo `creators` (Mix Ideias). Não é vulnerabilidade técnica
      direta, mas merece contrato de processamento de dados formalizado
      com o fornecedor — decisão de produto/jurídico.
