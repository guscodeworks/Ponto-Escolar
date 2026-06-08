# Relatorio de Auditoria de Seguranca

Data da auditoria: 2026-06-08

## Escopo analisado

- Workspace: `Ponto-Escolar`
- Projetos separados: `gov.br-fake` e `ponto-escolar`
- Arquivos proprios analisados fora de `.git` e `node_modules`: 154
- Distribuicao: 31 em `gov.br-fake`, 122 em `ponto-escolar`, 1 `AGENTS.md` da raiz
- `.env` locais foram analisados mesmo estando ignorados pelo Git.
- `node_modules` nao foi tratado como codigo-fonte proprio; dependencias foram auditadas por `npm audit --omit=dev`.
- Resultado de dependencias: 0 vulnerabilidades conhecidas em `ponto-escolar` e 0 em `gov.br-fake`.

Observacao: a auditoria preserva a regra do workspace: Gov.br autentica, Ponto Escolar autoriza. Os achados abaixo nao misturam codigo entre os projetos.

## Resumo Executivo

- Total de arquivos proprios analisados: 154
- Total de achados de seguranca: 12
- Critico: 1
- Alto: 4
- Medio: 6
- Baixo: 1
- Nota geral de seguranca: 6.5/10

| Severidade | Quantidade |
| ---------- | ---------- |
| Critico    | 1          |
| Alto       | 4          |
| Medio      | 6          |
| Baixo      | 1          |

Pontos fortes encontrados:

- O dashboard admin e as APIs admin principais dependem de `req.session.admin`, nao de token vindo do frontend.
- O callback Gov.br rejeita `access_token` em query string.
- O fluxo Gov.br usa `state`, PKCE e regeneracao de sessao apos login.
- As consultas SQL principais usam parametros (`?`) e transacoes.
- Senhas de funcionarios/admins sao comparadas/geradas com bcrypt.
- `npm audit --omit=dev` nao apontou vulnerabilidades conhecidas nas dependencias atuais.

Conclusao principal: o backend nao confia no frontend para permissao administrativa Gov.br, mas confia parcialmente no frontend para registro de ponto, principalmente em latitude/longitude e no transporte do QR Code. Portanto, a regra "o backend nunca deve confiar no frontend" ainda nao esta totalmente cumprida.

## Achados

### 1. Configuracao permite provedor Gov.br fake/HTTP sem trava de producao

Arquivo: `ponto-escolar/.env`

Linhas: 26-37

Categoria: Configuracao Insegura / Autenticacao Gov.br / Autorizacao Admin

Codigo encontrado:

```env
GOVBR_FAKE_BASE_URL= "http://localhost:4000"
GOVBR_FAKE_CLIENT_SECRET= "dev-secret"
GOVBR_AUTHORIZE_URL= "http://localhost:4000/fake-govbr/authorize"
GOVBR_TOKEN_URL= "http://localhost:4000/fake-govbr/token"
GOVBR_USERINFO_URL= "http://localhost:4000/fake-govbr/userinfo"
ADMIN_GOVBR_SUBS= "admin-local-001"
ADMIN_GOVBR_EMAILS= "admin@ponto-escolar.local"
```

Arquivo: `ponto-escolar/src/config/govbr.js`

Linhas: 47-52 e 117-126

Codigo encontrado:

```js
if (!['http:', 'https:'].includes(url.protocol)) {
  throwConfigError(`"${name}" must use HTTP or HTTPS`);
}

return Object.freeze({
  authorizeUrl: getAuthorizeUrl(fakeBaseUrl),
  tokenUrl: getTokenUrl(fakeBaseUrl),
  userInfoUrl: getUserInfoUrl(fakeBaseUrl),
  clientId: getRequiredFallbackValue('GOVBR_FAKE_CLIENT_ID', 'GOVBR_CLIENT_ID'),
  clientSecret: getRequiredFallbackValue('GOVBR_FAKE_CLIENT_SECRET', 'GOVBR_CLIENT_SECRET'),
  redirectUri: getOptionalUrl('GOVBR_FAKE_REDIRECT_URI', process.env.GOVBR_REDIRECT_URI),
  adminSubs: Object.freeze(adminSubs),
  adminEmails: Object.freeze(adminEmails)
});
```

O que esse codigo faz: configura o provedor OIDC/Gov.br e aceita URLs HTTP e variaveis fake como fallback.

Qual e o problema: se essas variaveis forem usadas fora da demonstracao local, qualquer usuario que consiga usar o simulador pode se autenticar como admin local. O codigo tambem nao falha em producao quando URLs fake, `localhost`, HTTP ou `dev-secret` estao configurados.

Nivel de risco: CRITICO

Impacto: comprometimento total da area administrativa.

Solucao recomendada: em `production`, exigir HTTPS, bloquear `localhost`, bloquear `/fake-govbr`, bloquear `dev-secret`, exigir `GOVBR_CLIENT_ID/GOVBR_CLIENT_SECRET` reais e preferir autorizacao por `sub` consultado internamente.

Codigo corrigido:

```js
function assertProductionGovbrConfig(config) {
  if (process.env.NODE_ENV !== 'production') return;

  const urls = [config.authorizeUrl, config.tokenUrl, config.userInfoUrl];
  urls.forEach((value) => {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || host === 'localhost' || host === '127.0.0.1') {
      throwConfigError('Gov.br real em producao deve usar HTTPS publico.');
    }
    if (url.pathname.includes('/fake-govbr')) {
      throwConfigError('Provedor fake nao pode ser usado em producao.');
    }
  });

  if (config.clientSecret === 'dev-secret') {
    throwConfigError('GOVBR_CLIENT_SECRET de desenvolvimento bloqueado em producao.');
  }
}
```

### 2. `gov.br-fake` cria sessao admin sem validar CPF/senha

Arquivo: `gov.br-fake/src/controllers/govbrAuthController.js`

Linhas: 201-218 e 326-329

Categoria: Autenticacao / Simulador / Escalacao de privilegio se exposto

Codigo encontrado:

```js
const sub = String(req.body.sub || env.fakeAdminSub).trim();
if (sub && !fakeUserService.findBySub(sub)) {
  throw requestError('Usuario fake nao encontrado.', 401, 'INVALID_FAKE_USER');
}

createFakeSession(res);

return res.status(200).json({
  success: true,
  authenticated: true,
  user: getFakeAdminUserInfo()
});
```

```js
return res.status(200).json({
  ...userInfo,
  role: 'admin'
});
```

O que esse codigo faz: qualquer POST valido em `/fake-govbr/login` cria sessao para o admin fake; `/userinfo` devolve `role: 'admin'`.

Qual e o problema: como simulador local isso e didatico, mas se ficar acessivel em rede publica/LAN junto com o `ponto-escolar` configurado para aceitar `admin-local-001`, vira bypass de admin.

Nivel de risco: ALTO

Possivel ataque: fazer POST em `/fake-govbr/login`, iniciar `/admin/auth/start` e receber sessao admin no `ponto-escolar`.

Impacto: acesso administrativo indevido no ambiente que estiver aceitando o simulador.

Solucao recomendada: manter o simulador preso a `localhost`, validar senha/sub no fake se houver tela de login, e nunca devolver `role` como autoridade de admin.

Codigo corrigido:

```js
function login(req, res, next) {
  try {
    const user = fakeUserService.authenticate({
      sub: req.body.sub || req.body.cpf,
      password: req.body.password
    });
    if (!user) {
      throw requestError('Credenciais fake invalidas.', 401, 'INVALID_FAKE_USER');
    }

    createFakeSession(res, user.sub);
    return res.status(200).json({
      success: true,
      authenticated: true,
      user: fakeUserService.toUserInfo(user)
    });
  } catch (error) {
    return next(error);
  }
}
```

### 3. Registro de ponto confia em latitude/longitude enviadas pelo navegador

Arquivo: `ponto-escolar/src/controllers/punchController.js`

Linhas: 235-250

Categoria: Backend confiando no Frontend / Validacao / Fraude de ponto

Codigo encontrado:

```js
const latitude = Number(req.body.latitude);
const longitude = Number(req.body.longitude);

if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
  throw new BadRequestError('Localizacao invalida para registro de ponto');
}

const distanceCheck = validateLocation(latitude, longitude);
```

O que esse codigo faz: valida se as coordenadas recebidas estao no formato certo e dentro do raio da escola.

Qual e o problema: o backend valida numeros, mas a origem dos numeros e o cliente. Um atacante pode enviar manualmente as coordenadas da escola sem estar la.

Nivel de risco: ALTO

Possivel ataque: chamar `POST /api/pontos/registrar` com JWT valido, QR valido e latitude/longitude da escola.

Impacto: ponto fraudulento.

Solucao recomendada: tratar GPS do navegador como evidencias, nao como prova unica. Combinar QR rotativo, janela curta, vinculo a sessao, auditoria persistente, analise de anomalias, eventualmente rede/dispositivo autorizado ou atestacao do app.

Codigo corrigido:

```js
const distanceCheck = validateLocation(latitude, longitude);
const riskFlags = [];

if (distanceCheck.distanceMeters > env.ALLOWED_RADIUS_METERS) {
  throw new ForbiddenError('Fora da area permitida.');
}

if (!req.body.locationAccuracy || Number(req.body.locationAccuracy) > 50) {
  riskFlags.push('LOCATION_LOW_CONFIDENCE');
}

await registerAuditLog({
  evento: 'batida_ponto_validada',
  funcionarioId: req.auth.id,
  metadados: { latitude, longitude, distance: distanceCheck.distanceMeters, riskFlags }
});
```

### 4. QR Code diario e deterministico, enviado por URL e sem revogacao real

Arquivo: `ponto-escolar/src/services/qrCodeService.js`

Linhas: 49-54, 88-105 e 149-150

Categoria: Token / QR Code / Exposicao em URL / Replay

Codigo encontrado:

```js
const payload = `${dayKey}:${unitCode}`;
return crypto.createHmac('sha256', env.JWT_SECRET).update(payload).digest('hex');
```

```js
const path = `/ponto/acessar?qr_code=${qrCode}`;
```

```js
async function deactivateQrCode(_id) {
  return false;
}
```

O que esse codigo faz: gera um QR fixo por dia/unidade com HMAC, coloca o segredo na query string e nao permite revogar.

Qual e o problema: qualquer pessoa que veja/copie a URL pode reutilizar o QR ate meia-noite. Query string pode aparecer em historico, logs, prints e referers.

Nivel de risco: ALTO

Possivel ataque: copiar o link `/ponto/acessar?qr_code=...`, compartilhar fora da escola e usar com credenciais validas.

Impacto: reduz a efetividade do QR como controle de presenca.

Solucao recomendada: gerar QR aleatorio persistido com hash, expiracao curta, revogacao e opcionalmente uso unico ou rotacao frequente. Evitar segredo em URL persistente; validar e trocar por cookie/challenge curto.

Codigo corrigido:

```js
async function createQrCode({ adminId, unidadeCodigo }) {
  const { token, tokenHash, expiresAt } = createTokenPayload(5);
  const result = await execute(
    `INSERT INTO qr_tokens (token_hash, unidade_codigo, criado_por, expira_em, ativo)
     VALUES (?, ?, ?, ?, 1)`,
    [tokenHash, getUnitCode(unidadeCodigo), adminId, expiresAt]
  );
  return { id: result.insertId, qr_code: token, expira_em: expiresAt };
}

async function validateQrCode(token) {
  const tokenHash = hashToken(token);
  const row = await executeOne(
    `SELECT * FROM qr_tokens
     WHERE token_hash = ? AND ativo = 1 AND expira_em > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  return { valid: Boolean(row), qrCode: row || null };
}
```

### 5. `SESSION_SECRET` fraco e `express-session` sem store persistente

Arquivo: `ponto-escolar/.env`

Linha: 3

Arquivo: `ponto-escolar/src/config/env.js`

Linha: 165

Arquivo: `ponto-escolar/src/app.js`

Linhas: 120-130

Categoria: Sessao / Configuracao Insegura

Codigo encontrado:

```env
SESSION_SECRET= "trocar_por_um_segredo_forte"
```

```js
SESSION_SECRET: getRequiredVar("SESSION_SECRET"),
```

```js
session({
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.IS_PRODUCTION
  }
})
```

O que esse codigo faz: configura sessao admin com segredo obrigatorio, mas sem validar forca, e usa o store padrao em memoria.

Qual e o problema: segredo previsivel e MemoryStore nao sao adequados para producao. MemoryStore perde sessoes ao reiniciar e pode crescer em memoria.

Nivel de risco: ALTO

Possivel ataque: se o segredo real for previsivel/vazar, aumenta risco de manipulacao de cookie/sessao; MemoryStore tambem facilita indisponibilidade.

Impacto: instabilidade e enfraquecimento da autenticacao admin.

Solucao recomendada: validar entropia do `SESSION_SECRET`, rotacionar segredo e usar store persistente como Redis/MySQL.

Codigo corrigido:

```js
function validateSessionSecret(secret) {
  const normalized = String(secret || '').trim();
  if (normalized.length < 48 || normalized === 'trocar_por_um_segredo_forte') {
    throwEnvError('"SESSION_SECRET" deve ter ao menos 48 chars aleatorios');
  }
  return normalized;
}

SESSION_SECRET: validateSessionSecret(getRequiredVar('SESSION_SECRET')),
```

```js
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: env.SESSION_SECRET,
  name: '__Host-ponto_admin',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', secure: env.IS_PRODUCTION, maxAge: 8 * 60 * 60 * 1000 }
}));
```

### 6. Login de funcionario usa limite alto de ponto, nao o limite de login

Arquivo: `ponto-escolar/src/routes/punchRoutes.js`

Linhas: 34-38

Arquivo: `ponto-escolar/src/middlewares/rateLimiters.js`

Linhas: 53-69

Categoria: Rate Limiting / Autenticacao

Codigo encontrado:

```js
router.post(
  '/login',
  pointLimiter,
  validate(funcionarioLoginSchema),
  loginFuncionario
);
```

```js
const loginLimiter = createLimiter({
  name: 'login',
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true
});

const pointLimiter = createLimiter({
  name: 'point',
  windowMs: env.POINT_RATE_LIMIT_WINDOW_MS,
  limit: env.POINT_RATE_LIMIT_MAX
});
```

O que esse codigo faz: aplica limite de ponto no login de funcionario.

Qual e o problema: no `.env` atual, `POINT_RATE_LIMIT_MAX` cai no default 500. Isso permite muitas tentativas de senha.

Nivel de risco: MEDIO

Possivel ataque: brute force de CPF/senha com QR valido.

Impacto: maior chance de comprometimento de conta de funcionario.

Solucao recomendada: usar `loginLimiter` no login e, idealmente, limitar por IP + CPF.

Codigo corrigido:

```js
const { pointLimiter, loginLimiter } = require('../middlewares/rateLimiters');

router.post(
  '/login',
  loginLimiter,
  validate(funcionarioLoginSchema),
  loginFuncionario
);
```

### 7. JWT de funcionario e estados legados ficam acessiveis ao JavaScript

Arquivo: `ponto-escolar/public/assets/js/funcionario-login.js`

Linhas: 98-104

Arquivo: `ponto-escolar/public/assets/js/app/00-core.js`

Linhas: 61-89

Categoria: JWT / XSS / Armazenamento de token

Codigo encontrado:

```js
sessionStorage.setItem('funcionario_token', data.token);
sessionStorage.setItem('funcionario_data', JSON.stringify(data.funcionario));
sessionStorage.setItem('func_nome', data.funcionario?.nome || '');
sessionStorage.setItem('func_cpf', cpf);
```

```js
const raw = localStorage.getItem(AUTH_STORAGE_KEY);
...
localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
```

O que esse codigo faz: guarda tokens/dados de autenticacao em `sessionStorage`/`localStorage`.

Qual e o problema: qualquer XSS consegue ler esses tokens. O proprio arquivo reconhece esse risco.

Nivel de risco: MEDIO

Possivel ataque: injetar script em pagina admin/funcionario e roubar JWT.

Impacto: sequestro de sessao de funcionario; em codigo legado, risco de confusao com auth admin.

Solucao recomendada: migrar para cookies `HttpOnly`, `Secure`, `SameSite=Strict` e remover armazenamento de JWT no navegador.

Codigo corrigido:

```js
res.cookie('funcionario_session', token, {
  httpOnly: true,
  secure: env.IS_PRODUCTION,
  sameSite: 'strict',
  maxAge: 20 * 60 * 1000
});

return res.status(200).json({
  success: true,
  data: { funcionario: mapFuncionario(funcionario) }
});
```

### 8. Renderizacao com `innerHTML` de dados vindos de API/banco

Arquivo: `ponto-escolar/public/assets/js/app/04-employees.js`

Linhas: 9-25 e 32-61

Arquivo: `ponto-escolar/public/assets/js/app/05-points-reports.js`

Linhas: 116-136

Categoria: XSS / Exposicao de Dados

Codigo encontrado:

```js
container.innerHTML = employees
  .map((employee) => {
    return `
      <div class="func-item-name">${employee.nome}</div>
      <div class="td-email">${employee.email}</div>
    `;
  })
  .join('');
```

O que esse codigo faz: monta HTML com dados de funcionario vindos da API.

Qual e o problema: os schemas atuais bloqueiam `<` em nomes criados pela API, mas dados antigos/importados, banco comprometido ou campos nao cobertos podem virar stored XSS.

Nivel de risco: MEDIO

Possivel ataque: inserir no banco um nome como `<img src=x onerror=...>` e abrir tela admin.

Impacto: roubo de sessoes/tokens, alteracao de dados no painel e acoes em nome do admin.

Solucao recomendada: renderizar texto com `textContent` ou escapar todos os dados antes de interpolar.

Codigo corrigido:

```js
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

container.innerHTML = employees.map((employee) => `
  <div class="func-item-name">${escapeHtml(employee.nome)}</div>
  <div class="td-email">${escapeHtml(employee.email)}</div>
`).join('');
```

### 9. Autorizacao admin aceita email alem de `sub`

Arquivo: `ponto-escolar/src/services/adminAuthorization.service.js`

Linhas: 5-13

Categoria: Autorizacao / Gov.br

Codigo encontrado:

```js
return Boolean(
  (userSub && adminSubs.includes(userSub)) ||
  (userEmail && adminEmails.includes(userEmail))
);
```

O que esse codigo faz: libera admin se o `sub` ou o email estiverem na lista.

Qual e o problema: email pode ser mutavel ou depender de atributo nao verificado pelo provedor. A regra do workspace recomenda comparar `userInfo.sub` com `ADMIN_GOVBR_SUBS`.

Nivel de risco: MEDIO

Possivel ataque: se o provedor/simulador retornar email administravel por terceiros, um usuario pode ser autorizado indevidamente.

Impacto: escalacao para dashboard admin.

Solucao recomendada: usar `sub` como identificador primario e mover permissao para banco interno com usuario ativo/perfil admin.

Codigo corrigido:

```js
function verificarSeUsuarioGovbrEhAdmin(userInfo) {
  const { adminSubs } = getGovbrConfig();
  const userSub = String(userInfo && userInfo.sub || '').trim();
  return Boolean(userSub && adminSubs.includes(userSub));
}
```

### 10. Auditoria nao e persistente

Arquivo: `ponto-escolar/src/services/auditLogService.js`

Linhas: 21-25

Categoria: Auditoria / Monitoramento

Codigo encontrado:

```js
const safeMetadata = metadados ? sanitizeForLog(metadados) : null;

// O schema atual (ponto (2).sql) nao possui tabela de auditoria persistente.
// Para evitar erros SQL, registramos os eventos apenas no logger da aplicacao.
logger.info('audit_evento', {
```

O que esse codigo faz: registra eventos sensiveis apenas no console/logger.

Qual e o problema: logs de console podem ser perdidos, rotacionados ou nao associados a trilha forense. Para ponto escolar, login, QR e batidas precisam de historico confiavel.

Nivel de risco: MEDIO

Possivel ataque: um atacante realiza acoes e reinicia/remove logs locais, dificultando investigacao.

Impacto: baixa rastreabilidade de incidentes e fraudes.

Solucao recomendada: persistir em tabela de auditoria append-only e manter mascaramento.

Codigo corrigido:

```js
await execute(
  `INSERT INTO auditoria_eventos
   (evento, nivel, admin_id, funcionario_id, mensagem, ip_origem, metadados_json, criado_em)
   VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
  [
    String(evento || 'evento_desconhecido'),
    mapLevel(nivel),
    adminId,
    funcionarioId,
    String(mensagem || 'Sem mensagem'),
    ipOrigem,
    JSON.stringify(safeMetadata)
  ]
);
```

### 11. Frontend de login nao envia QR Code exigido pelo backend

Arquivo: `ponto-escolar/public/assets/js/funcionario-login.js`

Linhas: 90-96

Arquivo: `ponto-escolar/src/schemas/auth.schema.js`

Linhas: 92-116

Categoria: Integridade do fluxo / Validacao

Codigo encontrado:

```js
const data = await apiRequest('/pontos/login', {
  method: 'POST',
  body: {
    cpf: cpf.replace(/\D/g, ''),
    senha
  }
});
```

```js
.refine(
  (data) => {
    const qr = data.qrCode || data.qr_code || data.qrToken;
    return !!qr && QR_TOKEN_REGEX.test(qr.trim());
  },
  { message: 'QR Code invalido ou ausente', path: ['qrCode'] }
)
```

O que esse codigo faz: o backend exige QR no login, mas o frontend envia apenas CPF/senha.

Qual e o problema: o controle de QR fica inconsistente. A correcao errada seria remover a exigencia do backend, o que enfraqueceria a seguranca.

Nivel de risco: MEDIO

Possivel ataque: pressao operacional para liberar login sem QR, transformando o ponto em login comum por CPF/senha.

Impacto: quebra do controle de acesso fisico por QR.

Solucao recomendada: validar QR em `/ponto/acessar`, trocar por cookie/challenge curto no backend e remover QR da URL antes de carregar login.

Codigo corrigido:

```js
router.get('/ponto/acessar', async (req, res, next) => {
  const qrCode = String(req.query.qr_code || '').trim();
  const validation = await validateQrCode(qrCode, { unidadeCodigo: schoolUnitCode });
  if (!validation.valid) return res.status(403).send('Acesso invalido');

  req.session.punchQr = { token: qrCode, createdAt: Date.now() };
  return res.redirect('/login');
});

async function loginFuncionario(req, res, next) {
  req.body.qrCode = req.session && req.session.punchQr && req.session.punchQr.token;
  return loginFuncionarioOriginal(req, res, next);
}
```

### 12. Higiene de dependencias e `.gitignore`

Arquivo: `ponto-escolar/package.json`

Linhas: 16 e 25

Arquivo: `ponto-escolar/.gitignore`

Linha: 56

Categoria: Supply Chain / Configuracao

Codigo encontrado:

```json
"crypto": "^1.0.1",
"path": "^0.12.7"
```

```gitignore
.sql
```

O que esse codigo faz: declara pacotes npm com nomes de modulos nativos do Node e tenta ignorar SQL com um padrao que so pega um arquivo chamado `.sql`.

Qual e o problema: `crypto` e `path` sao modulos nativos; os pacotes npm sao desnecessarios e aumentam superficie de supply chain. O padrao `.sql` provavelmente deveria ser `*.sql` se a intencao for bloquear dumps.

Nivel de risco: BAIXO

Possivel ataque: dependencia desnecessaria vira vetor futuro; dump SQL pode ser commitado por engano se o ignore estiver incorreto.

Impacto: higiene de seguranca reduzida.

Solucao recomendada: remover dependencias desnecessarias e corrigir padroes de ignore conforme a politica do projeto.

Codigo corrigido:

```json
"dependencies": {
  "bcrypt": "^6.0.0",
  "cors": "^2.8.6",
  "dotenv": "^17.4.2",
  "express": "^5.2.1"
}
```

```gitignore
*.sql
!database/schema/*.sql
```

## Verificacoes obrigatorias

Autenticacao:

- JWT de funcionario tem expiracao (`FUNCIONARIO_JWT_EXPIRES_IN=20m`) e segredo validado para `JWT_SECRET`.
- Senhas usam bcrypt.
- Admin Gov.br usa sessao local (`req.session.admin`) e nao token Gov.br como sessao principal.
- Risco pendente: `SESSION_SECRET` fraco e sem validacao de entropia.

Autorizacao:

- Rotas admin HTML usam `ensureAdminAuthenticated`.
- APIs admin usam `ensureAdminApiAuthenticated`.
- Risco pendente: autorizacao admin por email e configuracao fake sem hard fail de producao.

Validacao de dados:

- Zod cobre login, ponto, funcionarios e queries.
- Risco pendente: latitude/longitude sao validadas, mas continuam sendo declaradas pelo cliente.

Banco de dados:

- Nao encontrei SQL injection direto nas rotas principais; consultas usam parametros.
- Risco pendente: scripts locais com `multipleStatements` devem continuar restritos a uso administrativo.

APIs:

- Admin protegido por sessao.
- Login de funcionario esta rate-limited, mas com limiter errado/alto.

Arquivos sensiveis:

- `.env` existe localmente e esta ignorado pelo Git.
- Valores de desenvolvimento (`dev-secret`, `trocar_por...`) nao devem chegar a producao.

Seguranca geral:

- Helmet e CORS existem no `ponto-escolar`.
- Sem CSRF dedicado; SameSite ajuda, mas mutacoes admin por cookie deveriam considerar CSRF token se houver formularios cross-site.
- XSS residual por `innerHTML` em renderizacoes.
- Path traversal em `runSqlFile.js` foi mitigado por resolucao dentro do projeto.

Backend confiando no frontend:

- Admin Gov.br: nao encontrei liberacao por token vindo do frontend.
- Registro de ponto: o backend confia parcialmente em coordenadas e QR transportado pelo navegador.

## Prioridade de correcao

1. Bloquear provedor fake/HTTP/dev-secret em producao.
2. Corrigir isolamento do `gov.br-fake` e remover `role: admin` como autoridade.
3. Redesenhar QR Code com token aleatorio, expiracao curta e revogacao.
4. Reduzir confianca em latitude/longitude do navegador e reforcar antifraude.
5. Fortalecer `SESSION_SECRET` e trocar MemoryStore por store persistente.
6. Aplicar `loginLimiter` ao login de funcionario.
7. Migrar JWTs do navegador para cookies HttpOnly.
8. Corrigir renderizacao com `innerHTML`.
9. Autorizar admin somente por `sub`/banco interno.
10. Persistir logs de auditoria.
11. Corrigir fluxo frontend do QR sem remover validacao do backend.
12. Limpar dependencias e ajustar `.gitignore`.

## Conclusao Final

O backend confia parcialmente no frontend.

Ele nao confia no frontend para liberar o dashboard admin: a area administrativa principal depende de `req.session.admin`, o callback Gov.br valida `state`/PKCE e o `ponto-escolar` decide admin internamente.

Mas ele ainda confia no frontend para componentes criticos do ponto: latitude/longitude declaradas pelo navegador, QR Code trafegando em URL/sessionStorage e JWT de funcionario acessivel por JavaScript. Esses pontos devem ser corrigidos antes de tratar o sistema como pronto para ambiente real.
