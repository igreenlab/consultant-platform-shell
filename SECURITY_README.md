# Segurança — @igreen/platform-shell

Pacote biblioteca (não é o app-shell/host em si) que define o contrato de sessão
+ Module Federation consumido pelo host real (`virtual-office`, outro
repositório): `SessionProvider`/`useSession`, `moduleRegistry`, `ModuleSlot`,
`federationShared`.

Auditoria original: 2026-08-07 (autor: Dario C Oliveira). Revalidada em
2026-08-17 contra o `main` atual, já com os módulos `creators` e `store` ligados
no registry.

Sem segredo hardcoded (nem na árvore atual, nem no histórico), sem XSS
(`dangerouslySetInnerHTML`/`innerHTML`), sem `eval`/`new Function`, sem
`console.log` vazando token/PII, URLs dos módulos remotos fixas no registry
versionado (nunca vindas de input do usuário/query string).

A maior parte dos achados desta revisão não é corrigível só a partir deste
repositório — são decisões estruturais de todo o Virtual Office (armazenamento
de token, sandboxing de Module Federation, fechamento do SSO de terceiro) que
precisam ser avaliadas junto com o repo do host e os backends de cada módulo.

## Histórico de correções

| Item | Auditoria | Status no `main` |
|---|---|---|
| `isTokenExpired()` existia mas não era usado no próprio Provider | 2026-08-07 | ⏳ Aguardando merge de `security` |
| `apiBase` sem validação de origem no fetch default | 2026-08-07 | ⏳ Aguardando merge de `security` |
| Guard de origem burlável por URL protocol-relative (`//host`) | 2026-08-17 | ⏳ Aguardando merge de `security` |
| Logout de expiração só no mount, sem timer no `exp` | 2026-08-17 | ⏳ Aguardando merge de `security` |
| `isAdminRoute` não cobria sub-rotas da rota admin | 2026-08-17 | ⏳ Aguardando merge de `security` |
| Token em localStorage/sessionStorage sem isolamento entre módulos remotos | 2026-08-07 | 🟡 Pendência de arquitetura (VO todo) — ver Pendências |
| SSO Academy/Creators não fechado | 2026-08-07 | 🟡 Pendência de produto/arquitetura — ver Pendências |
| Módulos remotos sem SRI/hash, terceiro com confiança total | 2026-08-07 | 🟡 Pendência de arquitetura (host + CI/CD do terceiro) — ver Pendências |
| Nenhum guard de rota client-side neste pacote | 2026-08-07 | 🟡 Por design — delega ao host/backend, ver Pendências |
| CPF/CNPJ trafegando pro módulo de terceiro via singleton | 2026-08-07 | 🟡 Pendência de produto/jurídico (LGPD) — ver Pendências |

## Corrigido nesta revisão

### Médio — guard de origem do `apiBase` era burlável (2026-08-17)

`assertSameOriginApiBase` liberava qualquer `apiBase` que começasse com `/`,
assumindo "relativo ⇒ mesma origem". Não é verdade: `//evil.com` e
`/\evil.com` também começam com barra e resolvem para **outra origem** — o
primeiro é uma URL protocol-relative, o segundo porque o parser WHATWG trata
`\` como `/` em esquemas especiais. Nos dois casos o Bearer token do consultor
sairia do host na primeira chamada — exatamente o que o guard existe pra
impedir.

Agora a checagem resolve **sempre** contra `window.location.origin`, sem atalho
por prefixo, e só ignora quando não há origem para comparar (SSR/teste) ou
quando a URL é inválida (aí quem falha é o `fetch`, com o erro real).

### Baixo — logout de expiração só acontecia no mount (2026-08-17)

O efeito adicionado na revisão anterior deslogava ao detectar token expirado,
mas só reavaliava quando `token` mudava. Uma aba já aberta seguia com a sessão
de pé depois do `exp` passar, porque nada re-renderiza sozinho. Agora, além da
checagem imediata, o provider agenda o `logout()` para o instante do `exp`
(com guarda para o estouro de `setTimeout` acima de 2³¹-1 ms, que dispararia na
hora em vez de no futuro).

### Baixo — `isAdminRoute` não cobria sub-rotas (2026-08-17)

`matchRel` exigia número igual de segmentos, então
`isAdminRoute('/creators/admin-moderacao')` era `true` mas
`isAdminRoute('/creators/admin-moderacao/caso/42')` era `false`. Um host que
usasse esse helper como guard deixaria passar qualquer deep-link abaixo da rota
admin. Passou a casar por prefixo de segmentos, mantendo o pattern `/` restrito
à raiz do módulo (senão viraria curinga do módulo inteiro).

As duas barreiras documentadas do registry (fora da sidebar + fora do
`expose './Routes'`) seguem valendo — este helper é a terceira rede, e agora
funciona.

### Da revisão de 2026-08-07 (mantidas)

- **`isTokenExpired()` exportado mas nunca usado no próprio `SessionProvider`**:
  token com `exp` no passado ainda disparava a query do consultor e só falhava
  quando o backend respondia erro. A query passou a checar
  `!isTokenExpired(token)` no `enabled`.
- **`apiBase` sem validação de origem** no fetcher default.

## Verificação

`test/session-security.test.mjs` (9 testes) cobre: `apiBase` same-origin
aceito (relativo, sem barra, absoluto do host), origem externa recusada,
**as três formas de protocol-relative recusadas**, `isTokenExpired` nos três
casos (passado/futuro/sem `exp`), e `isAdminRoute` cobrindo sub-rotas sem virar
curinga. Os dois testes de bypass (`//evil`, sub-rota admin) **falham** na
versão anterior do código — foram escritos contra o defeito, não depois dele.

Suíte completa: **25 testes**, `tsc --noEmit` limpo, `tsup` reconstruindo o
`dist/` (committado de propósito — consumidores git-dep recebem build pronto).

⚠️ **Limite conhecido**: o logout proativo (efeito + timer) **não** tem teste
automatizado. Os testes do repo usam `renderToStaticMarkup`, que não roda
`useEffect`, e não há runner com DOM/`act` aqui. Cobrir isso exigiria adicionar
jsdom + testing-library ao pacote — decisão de escopo do time, não entrou nesta
rodada.

## Pendências antes de fechar

- [ ] **Alto — Token em localStorage/sessionStorage, sem isolamento entre
      módulos remotos** (`session/session-storage.ts`): decisão de arquitetura
      documentada ("sem cookies"), mas o risco fica amplificado pelo modelo de
      Module Federation — como `@igreen/platform-shell` é `singleton: true`,
      todo módulo remoto roda no mesmo contexto JS da página, sem sandbox de
      iframe. Um XSS ou pacote comprometido em qualquer módulo tem acesso
      direto a `window.localStorage`/`sessionStorage`. Mudar pra cookie
      httpOnly quebraria o modelo de Bearer token usado por todo o VO —
      decisão a tomar no nível do host, não deste pacote.
- [ ] **Alto — SSO Academy/Creators não fechado**: o próprio time documenta no
      README que `academy` e `creators` (session: `firebase-bridge`) dependem
      de uma ponte SSO que "pede revisão humana", e `creators` depende de
      confirmar o project ID com um fornecedor terceiro (Mix Ideias), com plano
      B só "se divergir". A ponte de identidade entre o JWT do VO e o Firebase
      custom token desses módulos não está fechada/validada segundo a própria
      documentação do time.
- [ ] **Alto — Módulos remotos sem verificação de integridade (SRI/hash)**
      (`federation/federationShared.ts`, `registry/moduleRegistry.ts`): o
      runtime de Module Federation carrega e executa o `remoteEntry.js` sem
      checar hash (limitação do próprio ecossistema MF). Combinado com
      `singleton: true` de React/deste pacote, qualquer comprometimento do
      pipeline de build/deploy/CDN de qualquer módulo — inclusive `creators`,
      operado por um terceiro (Mix Ideias), e agora também `store`, ambos já
      `enabled: true` — resulta em execução de código arbitrário com acesso
      total ao token de sessão e ao DOM do host. Mitigação real está fora deste
      pacote: CSP restritiva no host, controles de CI/CD e assinatura de build
      no módulo de terceiro, ou isolamento por iframe pra módulos não
      confiáveis.
- [ ] **Médio — Nenhum guard de rota client-side neste pacote**
      (`slot/ModuleSlot.tsx`): `ModuleSlot` monta a subárvore do remote
      incondicionalmente, sem checar `token`/`idconsultor` antes. Por design —
      a garantia real é o backend de cada módulo validar o JWT a cada chamada
      (INVARIANTE #1 do VO, documentado em `jwt.ts`) — mas significa que este
      pacote não oferece rede de segurança própria. Precisa ser confirmado no
      repo do host (`virtual-office`) e nos backends de
      `academy`/`creators`/`store`/demais módulos.
- [ ] **Médio — CPF/CNPJ trafegando pro módulo de terceiro via singleton**
      (`session/types.ts`, campo `Consultant.cpf`/`cnpj`): dado pessoal sob
      LGPD exposto via `useSession()` a todo módulo federado, incluindo
      `creators` (Mix Ideias). Não é vulnerabilidade técnica direta, mas merece
      contrato de processamento de dados formalizado com o fornecedor —
      decisão de produto/jurídico.
