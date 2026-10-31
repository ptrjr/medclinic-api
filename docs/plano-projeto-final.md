# Plano do projeto final SCTEC

Fonte: [proposta do professor](https://github.com/marcomoura-senai/nestjs-clinica), lida em 10/10/2026.

## Decisões de início

- Evoluir `ptrjr/medclinic-api`, preservando o histórico e os UUIDs.
- Manter Express 5, permitido em RP01, e TypeScript estrito.
- Cada funcionalidade será desenvolvida em branch própria e revisada em PR.
- A primeira entrega corrige a avaliação anterior e estabelece contrato, testes e CI.
- Credenciais do admin por seed com variáveis de ambiente, conforme RP07 atual.
- Domínio sem status HTTP; `AppError` é traduzido apenas no middleware.
- Regra de negócio em services/rules, com dublês nas portas de repositório.
- PostgreSQL, migrations, `timestamptz`, bcrypt e JWT.

## Entregas

| Ordem | Entrega / issue                                                               | Branch sugerida               | Estado registrado            | Aceitação principal                                  |
| ----- | ----------------------------------------------------------------------------- | ----------------------------- | ---------------------------- | ---------------------------------------------------- |
| 1     | [Base segura e CI #1](https://github.com/ptrjr/medclinic-api/issues/1)        | `feat/base-segura-sctec`      | Concluído (PR #8)            | Nove correções; contrato de auth; testes e CI        |
| 2     | [Pacientes #2](https://github.com/ptrjr/medclinic-api/issues/2)               | `feat/patients`               | Concluído (PR #12)           | CRUD, CPF único, busca e paginação                   |
| 3     | [Médicos #3](https://github.com/ptrjr/medclinic-api/issues/3)                 | `feat/doctors`                | Concluído (PR #11)           | Médico + usuário em uma transação; CRM único         |
| 4     | [Escalas e agenda #4](https://github.com/ptrjr/medclinic-api/issues/4)        | `feat/work-schedule-calendar` | Concluído (PR #13)           | Turnos sem sobreposição; agenda por período          |
| 5     | [Agendamentos #5](https://github.com/ptrjr/medclinic-api/issues/5)            | `feat/appointments`           | Concluído (PR #14)           | Validações, concorrência, posse e ciclo de status    |
| 6     | [Prontuários #6](https://github.com/ptrjr/medclinic-api/issues/6)             | `feat/medical-records`        | Concluído (PR #15)           | Escrita e leitura conforme vínculo médico-paciente   |
| 7     | [Publicação e evidências #7](https://github.com/ptrjr/medclinic-api/issues/7) | `ci/publicacao`               | Publicada; pendências finais | Acompanhamento, conferência global de rede e entrega |

O [Project público MEDCLINIC API - Projeto final SCTEC](https://github.com/users/ptrjr/projects/1) foi criado e vinculado a `ptrjr/medclinic-api` em **28/10/2026**, após confirmar a ausência de Project existente na conta. A visualização **Board** tem colunas pelo campo `Status`: Backlog, A fazer, Em andamento, Em revisão e Concluído. As sete issues existentes foram adicionadas sem duplicação; o campo `PRs e evidências` associa os PRs relevantes e os limites de cada entrega.

A organização inicial foi feita em 28/10/2026, com base em implementação, estado das issues e PRs incorporados; não foram inventadas movimentações ou datas históricas do board. Na consulta de 30/10/2026, issues #1–#6 estão em **Concluído**, com evidências nos PRs #8–#16 e na correção de agendamentos do #18. A issue #7 permanece **Em andamento** para as evidências finais, apesar da publicação inicial confirmada abaixo. Os cards de rascunho **Validação funcional completa da API** e **Conferência pública da API publicada** estão, respectivamente, em **Em revisão** e **Backlog**. A publicação inicial não encerra a conferência pública completa nem as demais pendências de entrega.

Requisito do documento fornecido: **20 commits reais e 6 PRs**. A entrega deve comprovar PRs incorporados com checks verdes. Os commits devem acompanhar mudanças reais; não criar commits vazios para preencher contagem. Essa quantidade não é uma divergência pendente de confirmação.

## Proteção da main — verificação de 28/10/2026

O PR [#18](https://github.com/ptrjr/medclinic-api/pull/18) foi confirmado como incorporado no commit `825360694317d5b6a9ec3106067aafb1bad4ea00`. A `main` local foi atualizada por fast-forward e a documentação desta etapa está na branch `docs/etapa-2-organizacao-github`, baseada nesse commit.

A inspeção inicial pela API retornou `Branch not protected` e nenhuma regra de ruleset aplicável. Foi criada uma única proteção clássica para `main` e a configuração foi relida após salvar:

- PR obrigatório, com `required_approving_review_count: 0`, sem exigir aprovação de outro revisor ou do próprio autor.
- Checks obrigatórios `validate`, `docker build` e `integration (PostgreSQL 16)`, com `strict: true` para exigir branch atualizada antes do merge.
- Os três checks foram confirmados no workflow `Validate pull request` do PR #18, com resultado aprovado na [execução de CI](https://github.com/ptrjr/medclinic-api/actions/runs/40795507858), e vinculados ao GitHub Actions (`app_id: 15368`).
- Aplicação ao administrador (`enforce_admins: true`), sem bypass configurado; force push e exclusão da `main` bloqueados.
- Sem merge queue, histórico linear obrigatório, aprovação de code owner ou aprovação do último push.

A autenticação do GitHub CLI confirmou a conta `ptrjr`, permissão `ADMIN` no repositório e escopo `project`. A proteção e o Project foram configurados por APIs oficiais, sem alterar secrets, variáveis de publicação ou outros repositórios. A criação do board e a proteção não comprovam publicação ou validação pública da API. Esta atualização de documentação segue em PR próprio para a `main`; sua incorporação não substitui essas validações.

## Validação funcional local — 29/10/2026

O PR [#19](https://github.com/ptrjr/medclinic-api/pull/19) foi incorporado por merge commit em `3258c55efae62c9ae4f9afac8a9f523327e5dedb`, depois de confirmar o head esperado e os três checks aprovados, sem bypass. A ETAPA 3 foi desenvolvida na branch `test/validacao-funcional-completa` e incorporada pelo PR #20, conforme o registro de publicação abaixo.

Foi consultado o [enunciado atual em `7fa5d59e0de3a637a3161a4373b5fcbb92a88b9d`](https://github.com/marcomoura-senai/nestjs-clinica/blob/7fa5d59e0de3a637a3161a4373b5fcbb92a88b9d/README.md). Essa referência ainda diverge internamente entre a seção detalhada 4.9.5 (somente admin altera escala) e o resumo 4.9.9 (inclui doctor), e entre 4.7 (10/3) e a rubrica (20/6). Isso não altera as decisões explícitas anteriores: somente admin altera escala e a meta de entrega continua em 20 commits reais e 6 PRs. As divergências foram registradas antes dos testes; o comportamento da API foi preservado.

A matriz própria executou **509 verificações aprovadas**, com **437 requisições HTTP reais** e **72 verificações de bootstrap/SQL**; 142 linhas são preparação por HTTP, separadas dos 367 demais casos. Abrange todas as rotas do contrato, controles de acesso, as 64 combinações de transição de status, vínculos de prontuário, persistência e limites de dia/fuso. O PostgreSQL era **16.15 real**, em Compose exclusivo com `tmpfs`, migrations e `synchronize: false`. O servidor normal compilado e o seed foram exercitados; repetir o seed preservou o administrador. Na repetição após a revisão pré-versionamento, a maior latência observada aquecida foi **300,95 ms**, com zero respostas acima de 5 segundos, sem garantia universal de desempenho.

A suíte transacional existente também aprovou **8 testes**, incluindo rollback e contenção observada entre conexões independentes. A suíte sem banco aprovou **432 testes**, com **100% nas quatro métricas** do recorte original de services/rules. Não foi comprovado defeito da aplicação: houve uma premissa incorreta no executor intermediário, corrigida conforme o formato da agenda, seguida de nova execução completa. O ambiente descartável foi limpo e removido.

Relatório, comandos, matriz de cada caso e limitações: [verificação funcional completa](verificacao-funcional-completa.md). O card da validação segue em **Em revisão**; não foi marcado Concluído. Naquela execução local, não houve bateria privada do professor nem conferência pública. O merge do #19 acionou a [publicação da imagem](https://github.com/ptrjr/medclinic-api/actions/runs/40905014779); o job `deploy Render` foi ignorado (`skipped`), sem alterar variáveis ou secrets. Publicação da API, banco gerenciado e URL pública estavam pendentes naquele registro; o estado posterior está na seção seguinte.

A revisão pré-versionamento reforçou somente o executor: recusa de schema preenchido antes de limpar e encerramento do servidor com timeout e fallback. Dois ensaios negativos controlados comprovaram preservação de uma tabela sentinela e limpeza após falha de bootstrap; ambos liberaram conexões e advisory lock. A matriz inteira foi então repetida, mantendo os **509 resultados aprovados**. Os ensaios de segurança são registrados separadamente, sem inflar essa contagem.

## Publicação e validação inicial — 30/10/2026

API pública: [https://medclinic-api-7n4q.onrender.com](https://medclinic-api-7n4q.onrender.com). Saúde: [GET /api/v1/health](https://medclinic-api-7n4q.onrender.com/api/v1/health), com HTTP 200 e `{"status":"ok"}` verificados diretamente em 30/10/2026 às 23:55:58 UTC.

Evidências verificadas diretamente nesta revisão:

- Na publicação inicial, a `main` estava no merge do [PR #20](https://github.com/ptrjr/medclinic-api/pull/20), commit `b62856f2d1e52595d6813a81e2b3a2bc69b28a00`. A revisão documental seguinte foi incorporada pelo [PR #21](https://github.com/ptrjr/medclinic-api/pull/21), confirmado no commit `59492649c16602a04ba7488e439d85e87665ebff`, base desta preparação final.
- A [tentativa 2 da execução 40974572290](https://github.com/ptrjr/medclinic-api/actions/runs/40974572290/attempts/2) terminou com `publish image` e `deploy Render` aprovados. A variável de ativação do repositório retornou `true`; nenhuma configuração foi alterada nesta revisão.
- O deploy Render retornou **Live**, concluído em 30/10/2026 às 23:53:17 UTC, com a imagem `ghcr.io/ptrjr/medclinic-api@sha256:ace89b626de08f35424fed9956a076806dc5cc4e787043935d6ab054920b85df`. O digest e a revisão correspondem aos metadados do job de publicação. O aceite do acionamento foi acompanhado pela confirmação do estado no provedor e pelo health público.
- O PostgreSQL retornou **Available**, versão **16**, plano **Free**, região **Virginia**, com expiração em **28/11/2026 às 23:56:11 UTC**. A configuração atual do Web Service também retornou plano **Free**, região **Virginia** e health check `/api/v1/health`.

Confirmações fornecidas pelo usuário: Web Service e banco seguem nos planos Free; o primeiro deploy ficou Live; login do administrador e `GET /api/v1/users/me` retornando perfil `admin` funcionaram. Após a configuração do deploy automático, Live, health e login foram novamente confirmados pelo usuário. A credencial de banco anteriormente exposta foi substituída e a antiga foi desativada. Esta revisão não acessou credenciais nem repetiu testes autenticados, rotação ou uma sondagem TLS do banco. A validação de certificado permanece prevista na configuração de produção e não foi relaxada.

As credenciais de avaliação serão fornecidas ao professor exclusivamente por canal privado. Nenhum valor de autenticação, conexão do banco ou acionamento de deploy integra este registro.

Pendências e limites:

- O usuário informou o teste de retomada registrado abaixo. Ele não é medição direta desta execução nem garantia de disponibilidade ou desempenho.
- Acompanhar o serviço e a expiração do banco durante todo o período de correção. O plano gratuito não representa disponibilidade permanente.
- **Segurança de rede:** a lista local do banco foi consultada somente em leitura, conforme análise abaixo. A regra global de Workspace relatada pelo usuário ainda precisa de confirmação no painel; nenhuma regra foi alterada.
- A bateria privada do professor **não foi executada**. Os 509 resultados anteriores são da matriz local própria; os testes iniciais públicos não equivalem à conferência funcional pública completa.
- A submissão ao AVA e a entrega das credenciais pelo canal privado permanecem pendentes.

### Retomada após inatividade — relato de 30/10/2026

O usuário informou que deixou a API sem acesso por **mais de 15 minutos** e observou:

| Verificação                         | Resultado informado pelo usuário   |
| ----------------------------------- | ---------------------------------- |
| Primeiro health após a espera       | `status: ok` em **32,49 segundos** |
| Segundo health                      | `status: ok` em **0,7 segundo**    |
| Login administrativo após despertar | **Login OK**                       |

Os tempos e o login não foram medidos nem repetidos nesta execução. Essa amostra indica retomada no teste do usuário, sem garantir disponibilidade contínua ou desempenho geral. O [plano Free do Render](https://render.com/docs/free#spinning-down-on-idle) suspende o Web Service após 15 minutos sem tráfego. O enunciado trata a retomada em RNF09 e o limite de cinco segundos **com a API já ativa** em RNF10; não se conclui aprovação desses requisitos na bateria de aceitação a partir de duas requisições. O PostgreSQL Free continua com expiração em **28/11/2026 às 23:56:11 UTC**; acompanhar API e banco durante a correção.

### Revisão de rede — somente leitura

A CLI autenticada retornou `ipAllowList` do banco com `74.220.49.0/24` e `74.220.57.0/24`, sem `0.0.0.0/0` nessa lista local. O inventário do workspace retornou somente `medclinic-api` e `medclinic-api-db`. Não foram acessados valores de conexão nem alteradas regras. A CLI 2.33.0 não expõe leitura das regras globais de Workspace; a linha global permanece como relato do usuário, sem confirmação direta do estado atual.

Pela [documentação do Render](https://render.com/docs/inbound-ip-rules#combining-ip-rules), regras no mesmo nível permitem a união das faixas; entre níveis, todos precisam permitir a conexão. Portanto, `0.0.0.0/0` no Workspace permite qualquer IPv4 **nesse nível**, mas não amplia uma lista local mais restrita. Isso não prova acesso efetivo apenas pelas duas faixas: falta conferir o nível global no painel. Essas regras incidem no acesso externo, não na rede privada; autenticação e TLS continuam necessários.

Possibilidades para uma execução futura, após autorização:

- Conferir **Workspace > Network Access > Inbound IP Restrictions**, o plano do workspace e todos os níveis aplicáveis, sem salvar nesta revisão. O Render oferece controles globais nos planos Scale/Enterprise; não inferir o efeito de uma linha exibida apenas a partir do plano Free do banco.
- Preservar a restrição específica do banco e conferir os CIDRs em **Web Service > Connect > Outbound**. As [faixas de saída são compartilhadas por região](https://render.com/docs/outbound-ip-addresses), não exclusivas desta API. Incluir somente origens administrativas necessárias, se houver, após avaliação.
- Antes de restringir o Workspace, inventariar novamente todos os recursos e consumidores: uma regra global pode bloquear outros serviços, inclusive a API pública usada pelo professor. Não aplicar automaticamente as faixas de saída do backend à entrada HTTP pública.
- Desabilitar o acesso externo e usar rede privada exige projeto separado: o procedimento atual usa endpoint externo com verificação de certificado, e o endpoint interno apresenta certificado autoassinado. Não trocar a conexão nem relaxar TLS para obter acesso. [Conexões PostgreSQL](https://render.com/docs/postgresql-creating-connecting#internal-connections).

### Lista objetiva para o AVA

Referência atual consultada: [enunciado em `dbab6ee4d46857df6ab0dfabf380319d3ce2604e`](https://github.com/marcomoura-senai/nestjs-clinica/blob/dbab6ee4d46857df6ab0dfabf380319d3ce2604e/README.md), seções 3, 4.3, 4.5–4.9 e 5.

Na tarefa **Módulo 02 - Projeto Final Avaliativo**, até **02/11/2026 às 22h**, enviar:

1. Repositório público: [ptrjr/medclinic-api](https://github.com/ptrjr/medclinic-api), cuja visibilidade foi confirmada diretamente no GitHub.
2. URL **raiz** da API: [https://medclinic-api-7n4q.onrender.com](https://medclinic-api-7n4q.onrender.com).
3. Board público: [MEDCLINIC API - Projeto final SCTEC](https://github.com/users/ptrjr/projects/1), com visibilidade pública confirmada diretamente.
4. Credenciais do administrador de avaliação no campo privado do AVA, conferidas na API publicada antes de enviar; nenhum valor neste documento ou no GitHub.

Antes de submeter:

- Finalizar os PRs pretendidos e conferir checks e publicação resultante. O enunciado usa a última atualização do repositório como data final e não aceita mudanças depois da entrega. A submissão ainda **não foi realizada**.
- Manter o repositório permanentemente público e API/banco disponíveis na correção, considerando despertar e expiração.
- Conferir código, migrations, Dockerfile multi-stage, Compose, dois workflows, proteção da `main`, histórico real de branches/PRs e board com critérios de aceitação e links. Preservar o registro honesto da organização tardia do board.
- Adotar o critério mais exigente da rubrica: **20 commits reais e 6 PRs incorporados com checks verdes**; a seção 4.7 menciona 10/3. Commits só de README não suprem conteúdo real. Não se auditou essa contagem nesta revisão.
- Conferir README com execução, variáveis sem valores reais, arquitetura, modelagem, nomenclatura, comandos, cobertura e endpoints/perfis. `.env` fora do Git; `.env.example` completo sem segredos; banco criado por migrations, com `synchronize: false`.
- Conferir contrato literal 4.9 e cobertura mínima de **80% nas quatro métricas** sobre regras de negócio. As evidências existentes são **432 testes sem banco**, **8 testes de integração PostgreSQL 16** e **509 verificações da matriz local própria**; não foram repetidas nesta mudança documental. A bateria privada do professor **não foi executada**.

## Rastreabilidade da avaliação anterior

| Ponto | Correção nesta etapa                                                            | Onde                                       |
| ----- | ------------------------------------------------------------------------------- | ------------------------------------------ |
| 1     | Remove cadastro público; criação administrativa autenticada e seed por ambiente | Rotas users, UserService, AdminSeedService |
| 2     | Valida e-mail, senha e roles antes do service; campo role antigo é recusado     | DTOs Zod e middleware de erro              |
| 3     | Autenticação, autorização e controllers lançam erros; um middleware responde    | Middlewares e AppError                     |
| 4     | Remove try/catch dos controllers; falhas inesperadas chegam ao logger central   | Controllers e error.middleware             |
| 5     | ESLint/Prettier, scripts e configuração de salvar no VS Code                    | Configurações de tooling e .vscode         |
| 6     | synchronize false; remove SQL paralelo e cria migrations                        | Database                                   |
| 7     | Controller → service → porta → repositório com métodos específicos              | UserService e TypeOrmUserRepository        |
| 8     | Dependências privadas recebidas pelo construtor; composição única               | composition-root.ts e classes              |
| 9     | Valida configuração no boot e documenta respostas dos endpoints                 | environment.ts e README                    |

## Casos mínimos de teste da proposta

| Caso exigido                                      | Etapa                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| Login inválido e comparação por hash              | Implementado na primeira etapa                                             |
| Cinco cenários de sobreposição de períodos        | Implementado em unidade no service de Agendamentos (revisão de 28/10/2026) |
| Criação válida e cinco falhas de turno/conflito   | Agendamentos                                                               |
| Turnos sobrepostos recusados e encostados aceitos | Implementado em Escalas                                                    |
| Transição válida e inválida                       | Agendamentos                                                               |
| Prontuário com vínculo e sem vínculo              | Implementado em Prontuários                                                |

O recorte de cobertura inclui todos os arquivos `.service.ts` e `.rules.ts`, mesmo os novos ainda sem teste. Cada métrica precisa continuar em pelo menos 80%.

A criação de agendamentos bloqueia médico e paciente e usa apenas o EntityManager transacional. O repositório seleciona períodos candidatos não cancelados por titular e janela temporal; o service aplica a regra de produção `a.startsAt < b.endsAt && b.startsAt < a.endsAt` antes de gravar. A revisão de 28/10/2026 acrescenta a matriz unitária para médico e paciente: antes/depois, bordas encostadas, contenção nas duas direções, cruzamento de cada borda e igualdade, além de ausência de gravação em conflito e prioridade do médico. Os dublês retornam períodos e não calculam interseção. Evidências: [Agendamentos](verificacao-agendamentos.md).

Além da verificação histórica em PGlite por TCP, a suíte de integração passou em PostgreSQL 16.15 real no Docker em 21/10/2026, observando contenção entre conexões independentes. Mocks unitários não comprovam o bloqueio transacional. A suíte preserva esses cenários e acrescenta matrizes de períodos e exclusão de canceladas para médico e paciente. Resultados por execução e instruções: [testes de integração PostgreSQL 16](testes-integracao-postgresql.md).

## Requisitos confirmados e decisões do enunciado

1. **Contagem de commits/PRs:** o documento fornecido exige 20 commits reais e 6 PRs. Requisito definido, sem pendência de confirmação; a comprovação do histórico e dos checks continua na lista de entrega.
2. **Escala:** o documento fornecido permite alteração somente por admin. A implementação segue esse requisito; qualquer perfil autenticado lê. Não há pendência de confirmação de permissão para doctor alterar escala.
3. **Erro 500:** RF11 exige envelope até 500, mas o catálogo não define código para falha interna. Implementamos `ERRO_INTERNO` apenas para erro inesperado e registramos o erro no servidor. Confirmar esse literal antes da entrega.
4. **Admin inicial:** o feedback anterior sugeria admin fixo na migration; RP07 da etapa final permite script de seed e exige credenciais por ambiente. O seed segue RP07, sem senha de produção versionada.

## Antes da entrega no AVA

Revisão de 19/10/2026: agendamentos incorporados pelo PR #14. Prontuários implementados sobre `806019f`, com vínculo por consultas `in_progress`/`done`, autoria pelo médico autenticado e acesso conforme RN14; incorporados pelo PR #15. Naquela etapa, a suíte registrava 384 testes e 100% nas quatro métricas de services/rules; os 42 testes novos estão em um único arquivo unitário. Foram verificadas adicionalmente 63 respostas HTTP com persistência PGlite e a migration de prontuários. Em 21/10/2026, os testes transacionais de médicos e agendamentos passaram em PostgreSQL 16.15 real, com 394 testes na suíte unitária e seis na integração. A publicação ainda estava pendente nessas revisões históricas; o registro de 30/10/2026 está acima. Evidências: [Agendamentos](verificacao-agendamentos.md), [Prontuários](verificacao-prontuarios.md) e [Integração PostgreSQL 16](testes-integracao-postgresql.md).

- [ ] Todos os endpoints da seção 4.9 implementados e conferidos literalmente.
- [x] Casos mínimos e cobertura de pelo menos 80% nas quatro métricas, reconferidos localmente em 29/10/2026: 432 testes e 100% em services/rules.
- [ ] PRs fechados com checks verdes e commits de conteúdo real.
- [x] Proteção da main ativa com PR obrigatório, três checks do GitHub Actions, branch atualizada, aplicação ao admin e bloqueio de force push/exclusão.
- [x] Project público vinculado ao repositório, visualização Board com os cinco estados, cards organizados por evidências e link incluído no README local.
- [ ] Registrar as próximas movimentações reais do board durante o trabalho, sem reconstruir histórico.
- [x] Executar e registrar a validação funcional completa local: 509 verificações aprovadas em PostgreSQL 16.15, com evidências em revisão.
- [ ] Fazer a conferência pública após publicação, incluindo disponibilidade e credenciais de avaliação.
- [x] Workflow `deploy.yml`, imagem de produção e deploy automático: jobs aprovados, deploy Live e health verificados em 30/10/2026; login após deploy confirmado pelo usuário.
- [x] PostgreSQL 16 Free disponível no Render, com expiração registrada; bootstrap da aplicação confirmado pelo usuário com Live e login. Sondagem TLS não repetida nesta revisão.
- [ ] URL pública disponível durante a correção, inclusive após inatividade.
- [x] Retomada após mais de 15 minutos sem acesso relatada pelo usuário em 30/10/2026: health em 32,49 s e 0,7 s; Login OK. Não é medição direta desta execução nem garantia geral.
- [x] Login do administrador de avaliação e perfil admin em `/api/v1/users/me` conferidos pelo usuário, inclusive após deploy automático.
- [x] README com URL, board, variáveis, arquitetura, comandos e respostas.
- [x] Consultar somente em leitura a lista local do banco e documentar a composição dos níveis conforme o Render.
- [ ] Confirmar no painel o estado atual e o alcance da regra de Workspace `0.0.0.0/0` antes de qualquer restrição global.
- [ ] Fornecer credenciais de avaliação ao professor por canal privado, sem publicá-las no GitHub.
- [ ] Submeter repositório público, URL raiz da API, board e credenciais no AVA até 02/11/2026 às 22h.
