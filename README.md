# MedClinic API

API REST de gestão clínica desenvolvida por Mauricio Petri Junior para o projeto final avaliativo do SCTEC / SENAI.

Esta é a evolução do mini-projeto de autenticação da Semana 07. A proposta final está no [repositório do professor](https://github.com/marcomoura-senai/nestjs-clinica).

## Estado do projeto

**Etapa 1 do projeto final: base segura de autenticação, usuários, migrations e CI.**

Implementado nesta etapa:

- Login JWT e autorização por múltiplos perfis: `admin`, `secretary` e `doctor`.
- Rotas sob `/api/v1`, resposta `accessToken` e campo `roles` como array.
- Criação de usuários exclusiva para administradores autenticados.
- DTOs Zod com validação de e-mail, senha e perfis.
- Erros de domínio traduzidos para o envelope HTTP por um único middleware.
- Services e controllers com injeção pelo construtor; composição em um único ponto.
- Repositório com `findByEmail`, `findById` e `createUser`.
- Migrations versionadas, `synchronize: false` e seed idempotente do primeiro admin.
- ESLint, Prettier, configuração do VS Code e testes unitários.
- Workflow de validação de PR com limite de cobertura de 80%.
- Dockerfile multi-stage e Docker Compose para PostgreSQL local.

Pacientes, médicos, escalas, agendamentos, prontuários e deploy são as próximas entregas. **A API ainda não foi publicada.** O Dockerfile está preparado; a imagem e o deploy serão verificados na etapa de publicação.

Backlog: [issues do projeto](https://github.com/ptrjr/medclinic-api/issues). Plano detalhado: [docs/plano-projeto-final.md](docs/plano-projeto-final.md).
Board público: ainda precisa ser criado e vinculado às issues; a lista de issues não substitui o board exigido na avaliação.

## Tecnologias

Node.js 22 LTS, TypeScript estrito, Express 5, TypeORM, PostgreSQL 16, Zod, bcrypt, JSON Web Token, Vitest, ESLint e Prettier.

O enunciado aceita Express e NestJS. Mantivemos Express para evoluir o trabalho anterior e deixar explícitas a composição e a injeção de dependências. Os UUIDs da etapa anterior foram preservados; o contrato não impõe o tipo da chave interna.

## Execução local

Pré-requisitos: Node.js 22.13 ou superior da linha 22 LTS (ou 24 LTS), npm e Docker com Compose.

```bash
git clone https://github.com/ptrjr/medclinic-api.git
cd medclinic-api
npm ci
cp .env.example .env
```

No PowerShell, use `Copy-Item .env.example .env` para copiar o arquivo. Se a política do PowerShell bloquear `npm.ps1`, execute os comandos com `npm.cmd`.

Preencha `.env`. Para uma instalação **exclusivamente local**, o login usado nos exemplos é `admin@medclinic.com`, com senha `SenhaForte@123`: defina esses valores em `ADMIN_EMAIL` e `ADMIN_PASSWORD` se desejar reproduzir os exemplos. Não há senha padrão automática no código. Na publicação, escolha credenciais próprias e forneça as de avaliação ao professor pelo AVA.

Gere um segredo JWT:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado para `JWT_SECRET` e escolha `DB_PASSWORD`. Depois:

```bash
docker compose up -d db
npm run migration:run
npm run seed:admin
npm run dev
```

A API escuta em `http://localhost:3000`, ou na porta definida por `PORT`.

Para executar o código compilado:

```bash
npm run build
npm start
```

`npm start` e `npm run dev` exigem um banco já migrado. O container de produção executa migrations e seed antes do servidor.

## Variáveis de ambiente

Todas as chaves estão em `.env.example`. O arquivo `.env` é ignorado pelo Git.

| Variável         | Uso                                          | Obrigatoriedade / padrão                                   |
| ---------------- | -------------------------------------------- | ---------------------------------------------------------- |
| `DB_HOST`        | Endereço do PostgreSQL                       | Obrigatória                                                |
| `DB_PORT`        | Porta do PostgreSQL                          | 5432                                                       |
| `DB_USERNAME`    | Usuário do banco                             | Obrigatória                                                |
| `DB_PASSWORD`    | Senha do banco e do Compose local            | Obrigatória                                                |
| `DB_DATABASE`    | Nome do banco                                | Obrigatória                                                |
| `DB_SSL`         | SSL com verificação do certificado           | `false` local; `true` na nuvem                             |
| `PORT`           | Porta HTTP; servidor escuta em `0.0.0.0`     | 3000                                                       |
| `JWT_SECRET`     | Assinatura do JWT, mínimo de 32 caracteres   | Obrigatória no servidor                                    |
| `JWT_EXPIRES_IN` | Prazo: segundos numéricos ou sufixos s/m/h/d | 1d; maior que zero e até 30 dias                           |
| `ADMIN_NAME`     | Nome do admin do seed                        | Administrador                                              |
| `ADMIN_EMAIL`    | E-mail do primeiro admin                     | Obrigatória no seed                                        |
| `ADMIN_PASSWORD` | Senha do primeiro admin                      | Obrigatória no seed; mínimo 8 caracteres e máximo 72 bytes |

O boot recusa configurações inválidas antes de conectar ou abrir a porta e informa os nomes das variáveis, sem imprimir valores de segredos. O CLI de migrations exige apenas configuração de banco.

## Banco, migrations e seed

```bash
npm run migration:show
npm run migration:run
npm run migration:revert
npm run seed:admin
```

Em produção, use `npm run migration:run:prod` e `npm run seed:admin:prod`, após o build.

As duas migrations iniciais:

1. Reconhecem a tabela `users` da etapa anterior ou criam a base em um banco vazio.
2. Convertem `Administrador` em `admin` e `Atendente` em `secretary`, preservando UUID, nome e hash; o perfil passa a ser um array. Convertem `createdAt` para `timestamptz` e normalizam e-mails.

A conversão do timestamp antigo considera os valores existentes como UTC. Antes de migrar uma base já usada, faça backup e confirme essa convenção. Se houver dois e-mails antigos que se tornam iguais após normalizar caixa/espaços, a migration falha e a transação preserva os dados; resolva a duplicidade antes de executar novamente.

O banco mantém unicidade de e-mail e uma restrição `CHECK` para os perfis permitidos. A senha continua na coluna original `password`, mapeada internamente como `passwordHash`, sem exposição no DTO.

`migration:revert` volta uma migration por vez. A reversão da segunda migration é bloqueada quando há usuários `doctor` ou com múltiplos perfis, para não descartar permissões silenciosamente. A reversão da primeira remove a tabela de usuários: use apenas em uma base de desenvolvimento descartável.

O seed não sobrescreve senhas nem promove usuários existentes. Se o e-mail já pertence a um admin, preserva as credenciais; se pertence a um usuário sem perfil admin, falha. Trocar `ADMIN_PASSWORD` e rodar o seed novamente **não altera a senha** de uma conta existente. A troca de senha será um fluxo administrativo separado.

O SQL avulso foi removido: as migrations são a fonte versionada do schema.

## Arquitetura e nomes

O controller valida o DTO e chama o service. O service aplica a regra de negócio sobre interfaces de repositório, senha e token. O adaptador de repositório usa TypeORM. `composition-root.ts` monta os objetos uma vez e injeta as dependências pelos construtores.

Services lançam `AppError` com códigos de domínio e não conhecem status HTTP. O middleware de erro é o único ponto que transforma essas falhas em respostas. As Promises dos controllers são retornadas pelas rotas; o Express 5 encaminha rejeições para esse middleware.

| Pasta / arquivo                            | Responsabilidade                                  |
| ------------------------------------------ | ------------------------------------------------- |
| `src/server.ts`                            | Validação do boot, conexão, escuta e encerramento |
| `src/app.ts`                               | Registro das rotas e middlewares                  |
| `src/composition-root.ts`                  | Montagem e injeção das dependências               |
| `src/config/`                              | Schemas de configuração                           |
| `src/controllers/`, `src/routes/`          | Fronteira HTTP                                    |
| `src/dtos/`                                | Validação e contratos de entrada/saída            |
| `src/services/`                            | Regras de negócio                                 |
| `src/domain/`, `src/errors/`, `src/ports/` | Tipos, erros de domínio e interfaces              |
| `src/repositories/`                        | Adaptadores TypeORM                               |
| `src/entities/`, `src/database/`           | Modelagem, migrations e seed                      |
| `src/infrastructure/`                      | Adaptadores bcrypt e JWT                          |
| `src/middlewares/`                         | Autenticação, autorização e tradução de erros     |
| `tests/`                                   | Testes unitários e dublês                         |

Arquivos em kebab-case com sufixos por responsabilidade (`.service.ts`, `.controller.ts`, `.repository.ts`, `.entity.ts`). Classes em PascalCase, variáveis e métodos em camelCase, perfis em minúsculas. As propriedades e os métodos declaram acesso explícito; dependências são `private readonly`.

## Qualidade, testes e cobertura

```bash
npm run lint
npx eslint --fix
npm run format:check
npm run typecheck
npm run build
npm test
npm run test:cov
```

Para formatação e correções: `npm run format` e `npm run lint:fix`. Instale as extensões recomendadas em `.vscode/extensions.json`; o VS Code está configurado para Prettier e correções ESLint ao salvar.

A cobertura considera **apenas `src/**/*.service.ts` e `src/**/*.rules.ts`**, onde ficam as regras de negócio. Controllers, entidades, migrations, configuração e adaptadores ficam fora da conta. Novos services/rules entram automaticamente. O limiar mínimo é 80% em statements, branches, functions e lines; abaixo disso o comando falha.

Nesta primeira etapa, são 82 testes, com 100% nas quatro métricas dos três services existentes. A suíte inclui login com comparação de hash, criação administrativa, ausência de elevação pública, seed idempotente, validação de dados/ambiente, JWT, bcrypt e envelope central de erro. Os casos exigidos de agendamento, escala e prontuário serão adicionados com os módulos correspondentes.

Os testes são unitários: não dependem de banco em execução, rede ou variáveis de ambiente. As portas recebem dublês nos testes dos services. Testes de adaptadores usam segredos e senhas fictícios passados diretamente.

## Endpoints implementados

| Método | Rota                 | Acesso      |
| ------ | -------------------- | ----------- |
| GET    | `/api/v1/health`     | Público     |
| POST   | `/api/v1/auth/login` | Público     |
| GET    | `/api/v1/users/me`   | Autenticado |
| POST   | `/api/v1/users`      | Admin       |

O cadastro público `/auth/register` foi removido. Não existe `/api/v1/auth/register`; a criação é interna por `POST /api/v1/users`, conforme RF13. As rotas antigas sem prefixo não são aliases.

### Saúde

`GET /api/v1/health` → **200**:

```json
{ "status": "ok" }
```

### Login

`POST /api/v1/auth/login`:

```json
{ "email": "admin@medclinic.com", "password": "SenhaForte@123" }
```

Resposta **200**:

```json
{ "accessToken": "<JWT>" }
```

E-mail e senha incorretos retornam a mesma resposta **401**:

```json
{ "statusCode": 401, "error": "CREDENCIAIS_INVALIDAS", "message": "Credenciais inválidas." }
```

### Usuário autenticado

`GET /api/v1/users/me`, com `Authorization: Bearer <accessToken>` → **200**:

```json
{
  "id": "20ba7288-1e53-4d79-8a38-4446c4840c28",
  "name": "Administrador",
  "email": "admin@medclinic.com",
  "roles": ["admin"]
}
```

### Criar usuário

`POST /api/v1/users`, com token de admin:

```json
{
  "name": "Joana Secretária",
  "email": "joana@medclinic.com",
  "password": "SenhaForte@123",
  "roles": ["secretary"]
}
```

Resposta **201**:

```json
{
  "id": "7c40a508-6dfe-424b-80ef-2e28cc2ad900",
  "name": "Joana Secretária",
  "email": "joana@medclinic.com",
  "roles": ["secretary"]
}
```

E-mail duplicado: **409** `EMAIL_JA_CADASTRADO`. Perfil inexistente, e-mail inválido, senha fora dos limites ou corpo incompleto: **400** `DADOS_INVALIDOS`. Sem token: **401** `NAO_AUTENTICADO`. Sem admin: **403** `ACESSO_NEGADO`.

### Erros

```json
{ "statusCode": 400, "error": "DADOS_INVALIDOS", "message": "Dados de entrada inválidos." }
```

Os erros conhecidos seguem o catálogo da seção 4.9.1 da proposta. Erros inesperados são registrados no servidor e retornam **500** com `ERRO_INTERNO`, sem stack ou detalhes internos. A proposta exige envelope até 500, mas não define código para esse caso; esta escolha está registrada no [plano](docs/plano-projeto-final.md).

## CI e publicação

`.github/workflows/pr-workflow.yml` roda em PRs para `main` com Node 22: instalação por `npm ci`, lint, formatação, tipagem, build e cobertura. O job tem nome estável `validate`.

Após o primeiro check verde, ative em **Settings → Branches → main**:

- Require a pull request before merging.
- Require status checks to pass before merging, selecionando `validate`.

O workflow não ativa proteção de branch sozinho. Sua ativação e o board público permanecem pendentes.

A publicação automática será implementada em um PR próprio: imagem no registro, banco gerenciado com SSL, secrets no painel da plataforma e `deploy.yml` disparado por push na `main`. Nenhuma URL pública ou execução de deploy é declarada como concluída nesta etapa.

Entrega prevista no enunciado: **02/11/2026 às 22h**. Consulte o [plano de entregas](docs/plano-projeto-final.md) antes de submeter ao AVA.
