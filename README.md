# MedClinic API

API REST de gestão clínica desenvolvida por Mauricio Petri Junior para o projeto final avaliativo do SCTEC / SENAI.

Esta é a evolução do mini-projeto de autenticação da Semana 07. A proposta final está no [repositório do professor](https://github.com/marcomoura-senai/nestjs-clinica).

## Estado do projeto

**Etapa 6 do projeto final: base segura, pacientes, médicos, escalas, agenda, agendamentos, prontuários, migrations e CI.**

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
- Pacientes com cadastro mínimo `name`/`cpf`, CPF de 11 dígitos único, filtro `name`, listagem `data/meta` e exclusão lógica. Leitura autenticada; cadastro/alteração para `admin` e `secretary`; exclusão somente por `admin`.
- Cadastro de médico com usuário `doctor` na mesma transação, CRM único, consultas autenticadas e paginação no envelope `data/meta`.

- Escala semanal substituída integralmente por admin, com turnos sem sobreposição.
- Agenda autenticada por período de até 31 dias locais em `America/Sao_Paulo`, com consultas persistidas e sem canceladas.
- Agendamento por `admin`/`secretary`, com duração calculada pela escala, bloqueios transacionais para médico e paciente, prevenção de conflitos e ciclo de status autorizado.
- Prontuário com autoria pelo médico autenticado, leitura/escrita por vínculo de atendimento, leitura administrativa e paginação.

Publicação e revisão final dos requisitos são as próximas entregas. **A API ainda não foi publicada.** O Dockerfile está preparado; a imagem e o deploy serão verificados na etapa de publicação.

O módulo de Pacientes foi ajustado ao contrato literal da seção 4.9.3. O corpo de cadastro contém apenas `name` e `cpf`; o PATCH altera apenas `name`. Campos adicionais da versão anterior permanecem preservados no banco, mas não integram a API pública.

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

A terceira migration cria `patients`. A quarta cria `doctors`, com CRM único, vínculo obrigatório com `users` e no máximo um médico por usuário. `DoctorRepository.createWithUser` recebe um hash e grava usuário e médico com os repositórios do mesmo `EntityManager` transacional. Uma falha em qualquer gravação reverte as duas. A reversão da quarta migration exige que `doctors` esteja vazia, para evitar usuários médicos sem registro profissional.

A quinta ajusta o contrato de pacientes, preservando dados anteriores. A sexta cria a escala semanal (`doctor_work_schedules`), e a sétima cria `appointments`, com vínculos obrigatórios de médico/paciente, período válido e status restrito a `scheduled`, `in_progress`, `done` e `cancelled`. Índices parciais apoiam a busca de consultas não canceladas. A reversão das duas últimas exige suas tabelas vazias, para não apagar escalas nem histórico de consultas. Substituir ou limpar uma escala altera somente sua própria tabela.

A oitava cria `medical_records`, com texto obrigatório, data `timestamptz`, chaves estrangeiras de paciente/médico e índice de ordenação por paciente e data. Acrescenta também um índice para consultas que estabelecem vínculo médico-paciente (`in_progress` ou `done`). A reversão é bloqueada se houver prontuários, preservando os dados. Pacientes removidos logicamente deixam de aparecer na API de prontuários, mas os registros permanecem no banco.

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
| `src/services/`, `src/rules/`              | Regras de negócio                                 |
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

Na etapa atual, são **394 testes sem banco externo e seis testes de integração em PostgreSQL 16**, com **100% nas quatro métricas dos nove services e três arquivos de regras** na suíte unitária. A suíte inclui login com comparação de hash, criação administrativa, ausência de elevação pública, seed idempotente, validação de dados/ambiente, proteção da configuração de integração, JWT, bcrypt, pacientes, médicos, escalas, agenda, criação e transições de agendamentos, prontuários e envelope central de erro.

Os 42 testes novos de Prontuários estão em um único arquivo, `tests/medical-record.unit.test.ts`: usam dublês nas portas e não dependem de banco, rede ou variáveis de ambiente. Cobrem vínculo concedido/negado, autoria derivada do token, privilégios, paciente inexistente, DTOs e paginação. A verificação adicional da API com persistência está descrita em [docs/verificacao-prontuarios.md](docs/verificacao-prontuarios.md).

Os testes de services são unitários e usam dublês nas portas. Testes HTTP usam servidores Express temporários em `127.0.0.1`, JWT real e os mesmos dublês, sem banco externo. Testes de adaptadores usam segredos e senhas fictícios passados diretamente.

O módulo de Médicos acrescenta testes de service com dublês e testes HTTP por servidor Express temporário em `127.0.0.1`, sem banco externo. Verificam acesso por perfil, corpo inválido, duplicidade, consulta, ausência de senha e envelope `data/meta`, incluindo query `pageSize`. Na etapa de Médicos a suíte tinha 129 testes; o service de Médicos alcança 100% nas quatro métricas. Evidências e limites da verificação de rollback: [docs/verificacao-medicos.md](docs/verificacao-medicos.md).

### Integração transacional em PostgreSQL 16

`npm run test:integration` executa seis cenários HTTP pela composição real da aplicação e pelos adaptadores TypeORM: cadastro/login de médico, rollback após falha no INSERT, corrida pelo UNIQUE de CRM, disputas por médico e por paciente e intervalos encostados. A suíte observa conexões independentes esperando por locks antes de liberar as disputas.

Use o banco descartável do `compose.integration.yaml` e configure as cinco variáveis `INTEGRATION_DB_*`. O único nome aceito é `medclinic_integration_test`; a suíte não carrega `.env` e recria o schema `public` desse banco. Instruções bash/PowerShell, proteções e garantias: [testes de integração PostgreSQL 16](docs/testes-integracao-postgresql.md).

O GitHub Actions mantém os checks atuais e acrescenta um job com serviço `postgres:16` e health check. Os testes unitários continuam sem banco externo, com o mesmo recorte de cobertura de services/rules. As verificações históricas em PGlite estão documentadas separadamente.

## Endpoints implementados

| Método | Rota                                          | Acesso                      |
| ------ | --------------------------------------------- | --------------------------- |
| GET    | `/api/v1/health`                              | Público                     |
| POST   | `/api/v1/auth/login`                          | Público                     |
| GET    | `/api/v1/users/me`                            | Autenticado                 |
| POST   | `/api/v1/users`                               | Admin                       |
| POST   | `/api/v1/patients`                            | Admin/secretary             |
| GET    | `/api/v1/patients`                            | Autenticado                 |
| GET    | `/api/v1/patients/:id`                        | Autenticado                 |
| PATCH  | `/api/v1/patients/:id`                        | Admin/secretary             |
| DELETE | `/api/v1/patients/:id`                        | Admin                       |
| POST   | `/api/v1/doctors`                             | Admin                       |
| GET    | `/api/v1/doctors`                             | Autenticado                 |
| GET    | `/api/v1/doctors/:id`                         | Autenticado                 |
| PUT    | `/api/v1/doctors/:doctorId/work-schedule`     | Admin                       |
| GET    | `/api/v1/doctors/:doctorId/work-schedule`     | Autenticado                 |
| GET    | `/api/v1/doctors/:doctorId/calendar`          | Autenticado                 |
| POST   | `/api/v1/appointments`                        | Admin/secretary             |
| GET    | `/api/v1/appointments`                        | Autenticado                 |
| GET    | `/api/v1/appointments/:id`                    | Autenticado                 |
| PATCH  | `/api/v1/appointments/:id/status`             | Conforme transição          |
| POST   | `/api/v1/patients/:patientId/medical-records` | Doctor com vínculo          |
| GET    | `/api/v1/patients/:patientId/medical-records` | Doctor com vínculo ou admin |

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

### Pacientes

`POST /api/v1/patients`, com token de `admin` ou `secretary`:

```json
{ "name": "Carlos Pereira", "cpf": "12345678901" }
```

Resposta **201**:

```json
{
  "id": "20ba7288-1e53-4d79-8a38-4446c4840c28",
  "name": "Carlos Pereira",
  "cpf": "12345678901",
  "createdAt": "2026-10-20T14:03:11.000Z"
}
```

O CPF deve ser uma string com exatamente 11 dígitos sem pontuação, conforme o contrato. Não são exigidos nascimento, telefone ou e-mail, nem verificação aritmética dos dígitos do CPF. O exemplo fictício do enunciado é aceito; pontuação, letras ou tamanho incorreto retornam **400** `DADOS_INVALIDOS`. CPF duplicado retorna **409** `CPF_JA_CADASTRADO`.

`GET /api/v1/patients?page=1&pageSize=20&name=carlos`, com token de qualquer perfil, responde **200**:

```json
{
  "data": [
    {
      "id": "20ba7288-1e53-4d79-8a38-4446c4840c28",
      "name": "Carlos Pereira",
      "cpf": "12345678901",
      "createdAt": "2026-10-20T14:03:11.000Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "pageSize": 20, "totalPages": 1 }
}
```

O filtro `name` faz busca parcial sem distinguir maiúsculas/minúsculas; os valores são parametrizados, e `%`/`_` não viram curingas. `page` tem padrão 1; `pageSize` tem padrão 20 e máximo 100. Query inválida retorna **400** `DADOS_INVALIDOS`. Sem resultados, retorna `data: []`, `total: 0` e `totalPages: 0`.

`GET /api/v1/patients/:id`, autenticado, retorna **200** com os quatro campos do cadastro ou **404** `RECURSO_NAO_ENCONTRADO`. UUID inválido retorna **400** `DADOS_INVALIDOS`.

`PATCH /api/v1/patients/:id`, para `admin` ou `secretary`:

```json
{ "name": "Carlos Pereira Atualizado" }
```

Resposta **200** com os mesmos campos, o novo `name` e o CPF original. Médico não altera pacientes (**403** `ACESSO_NEGADO`). Corpo vazio, nome vazio ou tentativa de alterar CPF retornam **400** `DADOS_INVALIDOS`.

`DELETE /api/v1/patients/:id` exige `admin` e responde **204** sem corpo. `secretary` e `doctor` recebem **403** `ACESSO_NEGADO`. Paciente inexistente ou já removido recebe **404**. A remoção é lógica (`deleted_at`); consultas/listagens ocultam o paciente removido. A linha histórica permanece no banco e seu CPF continua único/reservado.

Sem token, todas essas rotas retornam **401** `NAO_AUTENTICADO`. A migration adicional mantém os dados da versão anterior e torna nascimento/telefone opcionais no banco. Sua reversão é bloqueada quando há pacientes sem esses dados ou removidos, para não reativar registros nem descartar dados.

Na entrega da correção de Pacientes, a suíte tinha 186 testes com 100% nas quatro métricas de cobertura dos cinco services. Verificações adicionais do banco estão em [docs/verificacao-pacientes-contrato.md](docs/verificacao-pacientes-contrato.md).

### Médicos

`POST /api/v1/doctors`, com token de admin:

```json
{
  "name": "Dra. Helena Souza",
  "email": "helena@medclinic.com",
  "password": "SenhaForte@123",
  "crm": "CRM-SC-54321"
}
```

Resposta **201**:

```json
{
  "id": "338e7dbe-0f78-4d60-9de4-ab92a20de060",
  "crm": "CRM-SC-54321",
  "user": {
    "id": "bd89f57e-f7e0-42b3-8db7-df2f316a80f6",
    "name": "Dra. Helena Souza",
    "email": "helena@medclinic.com",
    "roles": ["doctor"]
  }
}
```

O médico pode autenticar imediatamente com o e-mail e a senha fornecidos. O cliente não escolhe o perfil; este cadastro sempre cria `doctor`. Senha e hash não aparecem nas respostas.

`GET /api/v1/doctors/:id`, com token de qualquer perfil, retorna **200** com o mesmo formato, **400** `DADOS_INVALIDOS` para UUID malformado ou **404** `RECURSO_NAO_ENCONTRADO` para médico inexistente.

`GET /api/v1/doctors?page=1&pageSize=20&name=helena`, autenticado, retorna **200**:

```json
{
  "data": [
    {
      "id": "338e7dbe-0f78-4d60-9de4-ab92a20de060",
      "crm": "CRM-SC-54321",
      "user": {
        "id": "bd89f57e-f7e0-42b3-8db7-df2f316a80f6",
        "name": "Dra. Helena Souza",
        "email": "helena@medclinic.com",
        "roles": ["doctor"]
      }
    }
  ],
  "meta": { "total": 1, "page": 1, "pageSize": 20, "totalPages": 1 }
}
```

O filtro `name` busca parte do nome sem distinguir maiúsculas e minúsculas, com consulta parametrizada. `page` começa em 1; `pageSize` tem padrão 20 e máximo 100. Uma página vazia retorna `data: []`; `meta.total` conta todos os médicos do filtro. Sem resultados, `totalPages` é 0.

CRM repetido: **409** `CRM_JA_CADASTRADO`. E-mail repetido: **409** `EMAIL_JA_CADASTRADO`. Corpo ou query inválidos: **400** `DADOS_INVALIDOS`. Sem token: **401** `NAO_AUTENTICADO`. Cadastro por `doctor` ou `secretary`: **403** `ACESSO_NEGADO`. CRM duplicado e falhas de gravação não deixam usuário de acesso parcial.

### Escala semanal

`PUT /api/v1/doctors/:doctorId/work-schedule`, com token de admin, substitui toda a escala:

```json
{
  "shifts": [
    { "weekDay": 2, "startTime": "08:00", "endTime": "12:00", "slotDurationMinutes": 30 },
    { "weekDay": 2, "startTime": "13:00", "endTime": "17:00", "slotDurationMinutes": 30 }
  ]
}
```

Resposta **200** com o mesmo objeto `shifts` enviado. `weekDay` vai de 0 (domingo) a 6 (sábado); horas usam `HH:MM`, de `00:00` a `23:59`. Início deve preceder o fim, e duração deve ser um inteiro positivo em minutos. Turnos do mesmo dia não podem se sobrepor; turnos encostados, como `08:00–10:00` e `10:00–12:00`, são aceitos. Turnos não atravessam a meia-noite.

Enviar `{"shifts":[]}` limpa a escala e responde **200** com `{"shifts":[]}`. A operação é transacional, bloqueia a linha do médico e grava a escala inteira. Consultas existentes permanecem intactas, inclusive quando deixam de se encaixar na nova escala (RN15).

`GET /api/v1/doctors/:doctorId/work-schedule`, com qualquer token válido, responde **200** com `{"shifts":[...]}` no formato acima. Médico existente sem escala retorna `{"shifts":[]}`.

Sem token: **401** `NAO_AUTENTICADO`. PUT por `doctor` ou `secretary`: **403** `ACESSO_NEGADO`. Médico inexistente: **404** `RECURSO_NAO_ENCONTRADO`. UUID, horários, duração ou sobreposição inválidos: **400** `DADOS_INVALIDOS`.

Decisão de acesso: o resumo do enunciado inclui `doctor` no PUT, mas a descrição detalhada e sua tabela de erros na seção 4.9.5 dizem somente admin. Esta implementação segue a seção detalhada; a divergência está registrada no plano para confirmação com o professor.

### Agenda do médico

`GET /api/v1/doctors/:doctorId/calendar?from=2026-10-13&to=2026-10-13`, com qualquer token válido, responde **200**:

```json
{
  "workSchedule": {
    "shifts": [
      { "weekDay": 2, "startTime": "08:00", "endTime": "12:00", "slotDurationMinutes": 30 }
    ]
  },
  "appointments": [
    {
      "id": "b8a7bb38-c016-4a68-8eaf-6a405c91c521",
      "patientId": "20ba7288-1e53-4d79-8a38-4446c4840c28",
      "startsAt": "2026-10-13T11:00:00.000Z",
      "endsAt": "2026-10-13T11:30:00.000Z",
      "status": "scheduled"
    }
  ]
}
```

`from` e `to` são obrigatórios em `YYYY-MM-DD`; os dois dias são inclusivos e o período tem de 1 a 31 dias. O filtro considera dias locais em `America/Sao_Paulo`, com as regras do fuso IANA, e consulta o intervalo do início de `from` até antes do dia seguinte a `to`. São retornadas consultas que intersectam esse intervalo, em ordem de início e ID. Os timestamps da resposta ficam em UTC.

Consultas `cancelled` são omitidas; `scheduled`, `in_progress` e `done` permanecem. A escala é semanal, sem geração de slots nem paginação. Sem dados, a resposta é `{"workSchedule":{"shifts":[]},"appointments":[]}`. Sem token: **401**; médico inexistente: **404**; UUID, datas inexistentes, ordem invertida ou mais de 31 dias: **400**.

Consultas podem ser criadas por `POST /api/v1/appointments`, descrito abaixo. A agenda continua exibindo somente consultas não canceladas. Evidências de SQL, rollback e limites da verificação da etapa anterior estão em [docs/verificacao-escalas-agenda.md](docs/verificacao-escalas-agenda.md).

### Agendamentos

`POST /api/v1/appointments`, com token de `admin` ou `secretary`:

```json
{
  "doctorId": "338e7dbe-0f78-4d60-9de4-ab92a20de060",
  "patientId": "20ba7288-1e53-4d79-8a38-4446c4840c28",
  "startsAt": "2026-10-20T12:00:00.000Z"
}
```

Resposta **201**:

```json
{
  "id": "b8a7bb38-c016-4a68-8eaf-6a405c91c521",
  "doctorId": "338e7dbe-0f78-4d60-9de4-ab92a20de060",
  "patientId": "20ba7288-1e53-4d79-8a38-4446c4840c28",
  "startsAt": "2026-10-20T12:00:00.000Z",
  "endsAt": "2026-10-20T12:30:00.000Z",
  "status": "scheduled"
}
```

O corpo aceita somente `doctorId`, `patientId` e `startsAt` com offset de fuso. O servidor calcula `endsAt` a partir da duração do turno. O início deve cair no dia/turno local da escala em `America/Sao_Paulo`, alinhar com a grade e permitir que a consulta inteira termine até o fim do turno. Médico ou paciente inexistente (ou paciente removido) retorna **404** `RECURSO_NAO_ENCONTRADO`; horário fora da escala retorna **422** `HORARIO_FORA_DA_ESCALA`; conflito com consulta ativa do médico retorna **409** `HORARIO_INDISPONIVEL`; conflito com consulta ativa do paciente, **409** `PACIENTE_INDISPONIVEL`. Intervalos que apenas encostam são aceitos. Consultas canceladas não bloqueiam horários.

A criação bloqueia as linhas do médico e do paciente na mesma transação, sempre nessa ordem, e faz validações e gravação com o `EntityManager` transacional. Isso serializa concorrência pelo mesmo médico e também pelo mesmo paciente em médicos diferentes.

`GET /api/v1/appointments?doctorId=<uuid>&patientId=<uuid>&status=scheduled&from=2026-10-20&to=2026-10-20&page=1&pageSize=20`, autenticado, responde **200**:

```json
{
  "data": [
    {
      "id": "b8a7bb38-c016-4a68-8eaf-6a405c91c521",
      "doctorId": "338e7dbe-0f78-4d60-9de4-ab92a20de060",
      "patientId": "20ba7288-1e53-4d79-8a38-4446c4840c28",
      "startsAt": "2026-10-20T12:00:00.000Z",
      "endsAt": "2026-10-20T12:30:00.000Z",
      "status": "scheduled"
    }
  ],
  "meta": { "total": 1, "page": 1, "pageSize": 20, "totalPages": 1 }
}
```

Todos os filtros são opcionais. `from`/`to` são datas locais inclusivas em `YYYY-MM-DD`, `page` começa em 1 e `pageSize` vai de 1 a 100 (padrão 20). Médico sem perfil admin vê somente as próprias consultas; pedir outro `doctorId` resulta em página vazia. `GET /api/v1/appointments/:id` retorna uma consulta; médico recebe **403** `ACESSO_NEGADO` se ela pertencer a outro médico. Secretária e admin podem consultar qualquer agendamento.

`PATCH /api/v1/appointments/:id/status` recebe `{"status":"in_progress"}` ou outro status do enum e responde **200** com o agendamento atualizado. Transições permitidas e perfis:

| Transição                   | Perfis autorizados              |
| --------------------------- | ------------------------------- |
| `scheduled` → `in_progress` | Admin ou médico dono            |
| `scheduled` → `cancelled`   | Admin, secretary ou médico dono |
| `in_progress` → `done`      | Admin ou médico dono            |
| `in_progress` → `cancelled` | Admin ou médico dono            |

Transição impossível retorna **422** `TRANSICAO_INVALIDA`; status inválido retorna **400** `DADOS_INVALIDOS`; falta de permissão retorna **403** `ACESSO_NEGADO`. Cancelar libera o horário para nova consulta.

Verificação desta etapa: 342 testes, lint, formatação, typecheck e build aprovados. A concorrência também foi exercitada por HTTP contra PostgreSQL-compatível PGlite, incluindo duas requisições simultâneas; essa prova não substitui ainda a execução em PostgreSQL 16. Detalhes: [docs/verificacao-agendamentos.md](docs/verificacao-agendamentos.md).

### Prontuários

Um médico tem vínculo com o paciente se existir ao menos uma consulta entre eles com status `in_progress` ou `done`. Consultas `scheduled` e `cancelled` não concedem acesso. A leitura autorizada retorna o prontuário do paciente, inclusive registros escritos por outros médicos.

| Perfil               | Escrever | Ler                 |
| -------------------- | -------- | ------------------- |
| `doctor` com vínculo | Sim      | Sim                 |
| `doctor` sem vínculo | Não      | Não                 |
| `admin`              | Não      | Sim, para auditoria |
| `secretary`          | Não      | Não                 |

Perfis são cumulativos: uma conta com `doctor` e `admin` precisa de vínculo para escrever como médico; para ler pode usar sua permissão administrativa. O perfil `admin` sozinho não concede escrita médica.

`POST /api/v1/patients/:patientId/medical-records`, com token de médico com vínculo:

```json
{ "text": "Paciente relata dor lombar há duas semanas. Solicitado raio-X." }
```

Resposta **201**:

```json
{
  "id": "84e621fe-9493-4bc9-86ce-2a4a6a62f8a4",
  "patientId": "20ba7288-1e53-4d79-8a38-4446c4840c28",
  "doctorId": "338e7dbe-0f78-4d60-9de4-ab92a20de060",
  "text": "Paciente relata dor lombar há duas semanas. Solicitado raio-X.",
  "createdAt": "2026-10-19T15:25:00.000Z"
}
```

`doctorId` é encontrado a partir do usuário autenticado, **nunca do corpo**. Se enviado, é ignorado, inclusive se tiver formato inválido. O `patientId` vem da rota. O texto é obrigatório e tem os espaços das extremidades removidos; texto vazio ou só com espaços retorna **400** `DADOS_INVALIDOS`.

`GET /api/v1/patients/:patientId/medical-records?page=1&pageSize=20`, por médico com vínculo ou admin, responde **200**:

```json
{
  "data": [
    {
      "id": "84e621fe-9493-4bc9-86ce-2a4a6a62f8a4",
      "patientId": "20ba7288-1e53-4d79-8a38-4446c4840c28",
      "doctorId": "338e7dbe-0f78-4d60-9de4-ab92a20de060",
      "text": "Paciente relata dor lombar há duas semanas. Solicitado raio-X.",
      "createdAt": "2026-10-19T15:25:00.000Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "pageSize": 20, "totalPages": 1 }
}
```

A ordem é `createdAt` decrescente, com desempate por `id` decrescente. `page` tem padrão 1; `pageSize` tem padrão 20 e máximo 100. Não há registros: `data: []`, `total: 0` e `totalPages: 0`. A query não altera o paciente da rota nem o médico usado para autorizar a requisição.

Sem token: **401** `NAO_AUTENTICADO`. Médico sem vínculo ou perfil sem permissão: **403** `ACESSO_NEGADO`. Paciente inexistente ou removido: **404** `RECURSO_NAO_ENCONTRADO` para perfis autorizados. UUID ou paginação inválidos: **400** `DADOS_INVALIDOS`. Datas são devolvidas em UTC, sem dados de login do autor.

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
