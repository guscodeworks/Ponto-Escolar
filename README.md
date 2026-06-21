# Ponto Escolar

Ponto Escolar é um TCC técnico em desenvolvimento para controle de ponto em ambiente escolar. O repositório reúne o sistema principal, responsável por funcionários, registros e acesso administrativo, e um simulador local do Gov.br usado para demonstrar o fluxo de autenticação.

## Objetivo

O sistema atende administradores e funcionários:

- o administrador autentica sua identidade por um provedor Gov.br/OIDC e acessa as funções administrativas após uma autorização interna;
- o funcionário entra com CPF e senha, recebe uma sessão JWT e registra até quatro batidas por dia dentro da área geográfica configurada.

A área administrativa cadastra funcionários, consulta presença e gera relatórios diários. Um QR Code direciona o funcionário para a tela de ponto.

## Projetos do repositório

| Projeto | Responsabilidade | Persistência |
| --- | --- | --- |
| [`ponto-escolar`](./ponto-escolar) | Sistema principal, páginas web, APIs, autorização administrativa, funcionários, ponto e relatórios | MySQL para os dados da aplicação; sessão administrativa configurada com `express-session` |
| [`gov.br-fake`](./gov.br-fake) | Simulador local do fluxo de autorização, emissão de código, troca por token e consulta de `/userinfo` | Memória do processo |

Os projetos possuem `package.json`, dependências e configuração próprios. Não existe um `package.json` na raiz.

### Limite de responsabilidade

> **Gov.br autentica. Ponto Escolar autoriza.**

O Gov.br, ou o simulador local, confirma a identidade apresentada no fluxo OAuth/OIDC. O `ponto-escolar` compara o identificador recebido com sua lista interna de administradores antes de criar a sessão administrativa.

Um token válido confirma a autenticação no provedor. Ele não concede permissão administrativa por conta própria. O back-end do `ponto-escolar` executa a autorização e protege páginas e APIs com `req.session.admin`.

O `gov.br-fake` serve para desenvolvimento, estudo e apresentação local. Ele não representa o serviço oficial do Gov.br e não deve ser publicado ou usado como provedor de produção.

## Funcionalidades implementadas

### Sistema principal

- autenticação administrativa por fluxo OAuth/OIDC;
- validação de `state` e PKCE com `S256`;
- autorização administrativa por `sub` ou e-mail configurado no back-end;
- sessão administrativa regenerada após o login;
- páginas e APIs administrativas protegidas;
- cadastro, listagem, edição, ativação e desativação de funcionários;
- login de funcionário com CPF ou e-mail e senha;
- emissão e validação de JWT com papel `funcionario`;
- nova consulta ao banco para confirmar que o funcionário continua ativo;
- registro de entrada, saída para almoço, retorno do almoço e saída;
- validação de latitude, longitude e raio permitido;
- transação no banco durante o registro de ponto;
- resumo de presença e relatório diário;
- validação de dados com `express-validator`;
- tratamento centralizado de erros e sanitização de logs;
- limitação de requisições, CORS e cabeçalhos de segurança.

### Simulador Gov.br

- tela local de autenticação demonstrativa;
- endpoint de autorização com `response_type=code`;
- validação de `client_id` e `redirect_uri`;
- emissão e consumo único de authorization code;
- validação de PKCE `S256`;
- troca do código por access token;
- consulta de identidade pelo endpoint `/userinfo`;
- sessão local em cookie `HttpOnly`;
- expiração e limpeza de sessões, códigos e tokens armazenados em memória.

## Tecnologias confirmadas

### Base do projeto

- Node.js;
- CommonJS;
- npm;
- HTML, CSS e JavaScript no front-end.

### `ponto-escolar`

- Express 5;
- MySQL com `mysql2`;
- `express-session`;
- JSON Web Token com `jsonwebtoken`;
- bcrypt;
- `express-validator`;
- `express-rate-limit`;
- Helmet;
- CORS;
- dotenv.

### `gov.br-fake`

- Express 5;
- fluxo OAuth 2.0/OpenID Connect simulado;
- PKCE `S256`;
- armazenamento em memória com `Map`;
- dotenv.

## Estrutura de pastas

```text
Ponto-Escolar/
├── AGENTS.md
├── ponto-escolar/
│   ├── server.js
│   ├── package.json
│   ├── package-lock.json
│   ├── public/
│   │   └── assets/
│   ├── views/
│   │   ├── admin/
│   │   └── funcionario/
│   └── src/
│       ├── app.js
│       ├── config/
│       ├── controllers/
│       ├── middlewares/
│       ├── models/
│       ├── routes/
│       ├── scripts/
│       ├── services/
│       └── utils/
└── gov.br-fake/
    ├── server.js
    ├── package.json
    ├── package-lock.json
    ├── public/
    ├── views/
    │   └── page/
    └── src/
        ├── app.js
        ├── config/
        ├── controllers/
        ├── models/
        ├── repositories/
        ├── routes/
        ├── services/
        └── utils/
```

O `ponto-escolar` segue uma estrutura MVC com services:

- `routes`: define URLs e encadeia middlewares e controllers;
- `controllers`: recebe `req` e `res`, chama os services e monta a resposta HTTP;
- `services`: concentra regras de negócio e integrações;
- `models`: executa consultas SQL;
- `middlewares`: valida autenticação, autorização, entrada e limites de requisição;
- `utils`: reúne funções pequenas compartilhadas.

## Pré-requisitos

- Node.js 18 ou superior, pois o sistema principal usa `fetch` global nas chamadas ao provedor;
- npm;
- MySQL acessível pelo `ponto-escolar`;
- navegador com acesso à localização para registrar ponto pela interface.

## Instalação

O repositório não possui instalação única na raiz. Instale cada projeto em sua pasta.

```bash
cd ponto-escolar
npm ci

cd ../gov.br-fake
npm ci
```

Os dois projetos possuem `package-lock.json`, por isso os passos acima usam `npm ci`.

## Configuração do ambiente

Cada projeto carrega seu próprio arquivo `.env`. Crie os arquivos dentro de `ponto-escolar/` e `gov.br-fake/`.

Não use os valores de exemplo como secrets reais. Mantenha `.env` fora do Git.

### `ponto-escolar/.env`

```dotenv
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=<usuario_mysql>
DB_PASSWORD=<senha_mysql>
DB_NAME=<nome_do_banco>
DB_CONNECTION_LIMIT=10

JWT_SECRET=<segredo_jwt_com_32_ou_mais_caracteres>
JWT_EXPIRES_IN=8h
FUNCIONARIO_JWT_EXPIRES_IN=20m
SESSION_SECRET=<outro_segredo_com_32_ou_mais_caracteres>

SCHOOL_LATITUDE=<latitude_da_escola>
SCHOOL_LONGITUDE=<longitude_da_escola>
SCHOOL_UNIT_CODE=<codigo_da_unidade>
ALLOWED_RADIUS_METERS=<raio_permitido_em_metros>

CORS_ORIGIN=http://localhost:3000
POINT_RATE_LIMIT_WINDOW_MS=300000
POINT_RATE_LIMIT_MAX=500

GOVBR_FAKE_BASE_URL=http://localhost:4000
GOVBR_FAKE_CLIENT_ID=<identificador_do_cliente_local>
GOVBR_FAKE_CLIENT_SECRET=<segredo_do_cliente_local>
GOVBR_FAKE_REDIRECT_URI=http://localhost:3000/auth/govbr/callback

ADMIN_GOVBR_SUBS=<identificador_sub_autorizado>
ADMIN_GOVBR_EMAILS=<email_autorizado_opcional>

BCRYPT_SALT_ROUNDS=12
```

Regras aplicadas pelo carregamento da configuração:

- `PORT`, conexão MySQL, coordenadas da escola, raio, CORS e tempos de JWT precisam ter formato válido;
- `JWT_SECRET` e `SESSION_SECRET` precisam ter ao menos 32 caracteres, combinar tipos diferentes de caracteres e usar valores distintos;
- `ADMIN_GOVBR_SUBS` ou `ADMIN_GOVBR_EMAILS` precisa conter ao menos um identificador;
- listas de `sub`, e-mails e origens CORS usam vírgulas como separador;
- `DB_PASSWORD` pode usar o alias legado `DB_PASS`;
- `GOVBR_FAKE_REDIRECT_URI` pode usar o alias `GOVBR_REDIRECT_URI`.

Ao conectar o sistema a outro provedor, configure os endpoints de forma explícita:

```dotenv
GOVBR_AUTHORIZE_URL=<url_de_autorizacao>
GOVBR_TOKEN_URL=<url_de_token>
GOVBR_USERINFO_URL=<url_de_userinfo>
GOVBR_CLIENT_ID=<identificador_do_cliente>
GOVBR_CLIENT_SECRET=<segredo_do_cliente>
GOVBR_REDIRECT_URI=<url_de_callback>
```

O código usa os endpoints derivados de `GOVBR_FAKE_BASE_URL` durante o desenvolvimento local. A integração com o Gov.br oficial depende de endpoints e credenciais fornecidos para a aplicação.

### `gov.br-fake/.env`

```dotenv
NODE_ENV=development
HOST=localhost
GOVBR_FAKE_PORT=4000

GOVBR_FAKE_CLIENT_ID=<mesmo_identificador_configurado_no_ponto_escolar>
GOVBR_FAKE_CLIENT_SECRET=<mesmo_segredo_configurado_no_ponto_escolar>

PONTO_ESCOLAR_REDIRECT_URI=http://localhost:3000/auth/govbr/callback
PONTO_ESCOLAR_START_URL=http://localhost:3000/auth/govbr/login

GOVBR_FAKE_ADMIN_SUB=<identificador_simulado>
GOVBR_FAKE_ADMIN_NAME=<nome_simulado>
GOVBR_FAKE_ADMIN_EMAIL=<email_simulado>
```

O simulador possui valores padrão para desenvolvimento. A configuração explícita evita divergências entre `client_id`, client secret e callback dos dois projetos.

Use somente dados fictícios no `gov.br-fake`.

## Banco de dados

O `ponto-escolar` abre a conexão MySQL antes de iniciar o servidor. Se o banco não estiver acessível, o processo encerra a inicialização.

O código consulta as seguintes tabelas:

- `admins`;
- `funcionarios`;
- `login`;
- `cargo`;
- `registro_de_pontos`.

Execute estes comandos a partir de `ponto-escolar/`:

```bash
# Inicializa o banco a partir de um schema localizado pelo script
npm run db:init

# Executa um arquivo SQL que esteja dentro de ponto-escolar/
npm run db:run -- --file=caminho/arquivo.sql

# Cria um registro na tabela admins
npm run admin:create -- \
  --name="Nome do administrador" \
  --email="admin@exemplo.local" \
  --password="<senha_com_12_ou_mais_caracteres>"
```

O comando `admin:create` grava um administrador na tabela `admins`. O fluxo administrativo ativo usa Gov.br/OIDC e a allowlist `ADMIN_GOVBR_SUBS` ou `ADMIN_GOVBR_EMAILS`; criar esse registro não substitui a autorização do fluxo Gov.br.

Consulte [Status atual e pontos a evoluir](#status-atual-e-pontos-a-evoluir) antes de executar `db:init` em uma instalação nova.

## Como executar

### Opção 1: processos separados

Inicie o simulador:

```bash
cd gov.br-fake
npm start
```

Em outro terminal, inicie o sistema principal:

```bash
cd ponto-escolar
npm start
```

Endereços padrão da configuração local:

- sistema principal: `http://localhost:3000`;
- dashboard administrativo: `http://localhost:3000/admin/dashboard`;
- início do fluxo administrativo: `http://localhost:3000/auth/govbr/login`;
- simulador: `http://localhost:4000/govbr`;
- health check principal: `http://localhost:3000/health`;
- health check do simulador: `http://localhost:4000/health`.

### Opção 2: execução conjunta

O script `dev` usa `concurrently` para iniciar os dois processos:

```bash
cd ponto-escolar
npm run dev
```

Esse comando pressupõe que as dependências foram instaladas nas duas pastas.

### Outros comandos

No `ponto-escolar`:

```bash
npm run start:ponto
npm run start:govbr
```

No `gov.br-fake`:

```bash
npm run check
```

A seção de pontos a evoluir registra o estado atual do comando `check`.

## Fluxo de autenticação administrativa

```text
Navegador
   |
   | acessa /admin/dashboard
   v
ponto-escolar verifica req.session.admin
   |
   | sem sessão
   v
/auth/govbr/login
   |
   | gera state, codeVerifier e codeChallenge
   v
Gov.br ou gov.br-fake
   |
   | autentica a identidade e retorna code + state
   v
/auth/govbr/callback
   |
   | valida state e troca code por token com PKCE
   v
/userinfo
   |
   | retorna sub, nome e e-mail
   v
ponto-escolar consulta sua allowlist
   |
   | autorizado
   v
cria req.session.admin e libera o dashboard
```

O back-end executa esta sequência:

1. O middleware procura `req.session.admin`.
2. O controller gera `state`, `codeVerifier` e `codeChallenge`.
3. A sessão guarda os dados temporários do fluxo.
4. O provedor devolve um authorization code no callback.
5. O back-end rejeita callback que tente enviar `access_token` pela URL.
6. O back-end compara o `state` recebido com o valor da sessão.
7. O service troca o código por token e envia o `code_verifier`.
8. O service consulta `/userinfo` com `Authorization: Bearer`.
9. O `ponto-escolar` compara `sub` ou e-mail com a configuração administrativa.
10. O controller regenera a sessão e grava `req.session.admin`.

As páginas administrativas e as rotas `/api/admin/*` repetem a verificação da sessão e da allowlist. O front-end não decide quem possui acesso administrativo.

## Fluxo de registro de ponto

1. O funcionário informa CPF ou e-mail e senha.
2. O service compara a senha com o hash bcrypt armazenado.
3. O back-end confirma que o funcionário está ativo.
4. O sistema emite um JWT com o papel `funcionario`.
5. A requisição de ponto envia o JWT no cabeçalho `Authorization: Bearer`.
6. O middleware valida o JWT e consulta o funcionário no banco.
7. O back-end valida latitude e longitude.
8. O service calcula a distância até as coordenadas da escola.
9. Uma transação bloqueia o funcionário e o registro do dia durante a atualização.
10. O sistema registra a próxima batida disponível.

A ordem diária é:

1. `ENTRADA`;
2. `SAIDA_ALMOCO`;
3. `VOLTA_ALMOCO`;
4. `SAIDA`.

Após a quarta batida, uma nova tentativa retorna conflito. O sistema calcula data e horário com o fuso `America/Sao_Paulo`.

## QR Code

O back-end gera um atalho fixo para:

```text
/ponto/acessar
```

Ele direciona o funcionário para a tela de acesso ao ponto. O QR Code não contém credencial de login, token de funcionário ou autorização administrativa.

O funcionário ainda precisa se autenticar, enviar um JWT válido e cumprir a validação de localização para registrar o ponto.

## Rotas principais

### `ponto-escolar`

| Método | Rota | Função |
| --- | --- | --- |
| `GET` | `/health` | Verifica se o processo HTTP está respondendo |
| `GET` | `/auth/govbr/login` | Inicia o fluxo administrativo |
| `GET` | `/auth/govbr/callback` | Processa o authorization code |
| `GET` ou `POST` | `/auth/govbr/logout` | Encerra a sessão administrativa |
| `GET` | `/admin/dashboard` | Exibe o dashboard protegido |
| `GET` | `/ponto/acessar` | Exibe a entrada para o fluxo de ponto |
| `POST` | `/ponto/login` | Autentica o funcionário |
| `POST` | `/ponto/registrar` | Registra a próxima batida |
| `POST` | `/ponto/bater` | Alias para registro da próxima batida |
| `GET` | `/api/admin/auth/me` | Consulta a sessão administrativa |
| `GET` ou `POST` | `/api/admin/funcionarios` | Lista ou cadastra funcionários |
| `PATCH` | `/api/admin/funcionarios/:id` | Altera dados do funcionário |
| `PATCH` | `/api/admin/funcionarios/:id/status` | Altera o estado ativo do funcionário |
| `GET` | `/api/admin/pontos/hoje` | Consulta presença por data |
| `GET` | `/api/admin/pontos/relatorio` | Gera o relatório diário |
| `GET` | `/api/admin/pontos/resumo` | Consulta o resumo do dashboard |

As rotas de login e registro de ponto também aparecem sob `/api/pontos`.

### `gov.br-fake`

| Método | Rota | Função |
| --- | --- | --- |
| `GET` | `/govbr` | Exibe a tela simulada |
| `GET` | `/health` | Informa o estado do simulador |
| `GET` | `/service-info` | Lista informações e rotas do serviço local |
| `GET` | `/fake-govbr/authorize` | Valida a solicitação e emite authorization code |
| `POST` | `/fake-govbr/login` | Cria a sessão de usuário simulado |
| `GET` | `/fake-govbr/logout` | Remove a sessão simulada |
| `GET` | `/fake-govbr/session` | Consulta a sessão local |
| `POST` | `/fake-govbr/token` | Troca o código por access token |
| `GET` | `/fake-govbr/userinfo` | Retorna os dados do usuário do token |

## Regras de segurança

- Mantenha senhas, client secrets, chaves JWT e secrets de sessão em `.env`.
- Use valores diferentes para `JWT_SECRET` e `SESSION_SECRET`.
- Não envie access token pela URL.
- Inicie o login administrativo em `/auth/govbr/login`; não chame o callback de forma direta.
- Preserve a validação de `state` e PKCE.
- Autorize administradores no `ponto-escolar`, com dados controlados pelo back-end.
- Não confie em cargo, papel ou permissão enviados pelo front-end.
- Não trate o QR Code como prova de identidade ou permissão.
- Use dados fictícios no simulador.
- Não exponha o `gov.br-fake` como serviço oficial.
- Restrinja `CORS_ORIGIN` aos endereços usados pela aplicação.

O back-end usa consultas parametrizadas nas operações MySQL, bcrypt para senhas, cookies `HttpOnly`, validação de entrada, limite de corpo, rate limiting e sanitização de dados nos logs.

## Status atual e pontos a evoluir

O projeto está em desenvolvimento como TCC técnico. O código implementa o fluxo local entre o sistema principal e o simulador, as páginas administrativas, o cadastro de funcionários, o login de funcionário, a validação geográfica e o registro de quatro batidas.

O status atual mantém estas pendências técnicas:

- **Schema SQL versionado:** o script `npm run db:init` procura `database/schema/ponto.sql`, `ponto (2).sql` ou `ponto.sql`. O repositório não inclui esses arquivos no estado atual. Uma instalação nova precisa de um schema compatível com as tabelas consultadas pelo código.
- **Testes automatizados:** os projetos não possuem suíte de testes nem comando `npm test`.
- **Arquivos de exemplo de ambiente:** os `.gitignore` permitem `.env.example`, mas o repositório ainda não fornece esse arquivo em nenhuma das pastas.
- **Validação do simulador:** `npm run check` aponta para `src/server.js`, enquanto o arquivo executável está em `gov.br-fake/server.js`. O script precisa ser ajustado para validar o arquivo correto.
- **Persistência de sessão administrativa:** o `ponto-escolar` usa o store padrão em memória do `express-session`. Um ambiente com reinício de processo ou mais de uma instância precisa de um store persistente.
- **Persistência do simulador:** sessões, authorization codes e access tokens ficam em memória e desaparecem quando o `gov.br-fake` reinicia. Esse comportamento atende ao uso local demonstrativo.
- **Integração oficial:** endpoints, credenciais, cadastro do cliente e regras operacionais do Gov.br real dependem de definição externa ao repositório.
- **Logout por provedor:** o logout administrativo atual redireciona para a rota do `gov.br-fake`. A integração real precisa de configuração própria para encerramento de sessão.
- **QR Code:** o fluxo atual fornece um atalho fixo para a tela de ponto. A rota de desativação não altera esse atalho.
- **Versão do Node.js:** o código exige recursos presentes no Node.js 18+, mas os `package.json` ainda não declaram o campo `engines`.

### Informações a confirmar

- schema SQL que será adotado como referência do projeto;
- endpoints e credenciais da integração oficial com Gov.br;
- store de sessão para um ambiente fora da demonstração local;
- estratégia de execução e hospedagem após a conclusão do TCC.

## Próximos passos

1. Versionar um schema SQL revisado e adicionar `.env.example` sem credenciais.
2. Criar testes para autenticação, autorização, funcionários e registro de ponto.
3. Corrigir o comando `check` do simulador e declarar a versão suportada do Node.js.
4. Configurar persistência de sessão antes de executar o sistema em mais de uma instância.
5. Adaptar endpoints e logout quando as credenciais oficiais do Gov.br estiverem disponíveis.
6. Revisar os arquivos de autenticação legada antes de removê-los ou incorporá-los ao fluxo atual.

## Aviso sobre o `gov.br-fake`

O `gov.br-fake` existe para demonstração técnica local. Ele:

- não possui vínculo com o Governo Federal;
- não substitui o Gov.br ou o Login Único;
- não deve receber dados pessoais reais;
- não deve ser usado em produção;
- não decide quem administra o Ponto Escolar.

A autorização administrativa pertence ao `ponto-escolar`, mesmo quando o simulador retorna uma identidade autenticada.
