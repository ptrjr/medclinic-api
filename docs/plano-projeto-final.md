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

| Ordem | Entrega / issue                                                               | Branch sugerida               | Estado inicial     | Aceitação principal                                |
| ----- | ----------------------------------------------------------------------------- | ----------------------------- | ------------------ | -------------------------------------------------- |
| 1     | [Base segura e CI #1](https://github.com/ptrjr/medclinic-api/issues/1)        | `feat/base-segura-sctec`      | Concluído (PR #8)  | Nove correções; contrato de auth; testes e CI      |
| 2     | [Pacientes #2](https://github.com/ptrjr/medclinic-api/issues/2)               | `feat/patients`               | Concluído (PR #12) | CRUD, CPF único, busca e paginação                 |
| 3     | [Médicos #3](https://github.com/ptrjr/medclinic-api/issues/3)                 | `feat/doctors`                | Concluído (PR #11) | Médico + usuário em uma transação; CRM único       |
| 4     | [Escalas e agenda #4](https://github.com/ptrjr/medclinic-api/issues/4)        | `feat/work-schedule-calendar` | Concluído (PR #13) | Turnos sem sobreposição; agenda por período        |
| 5     | [Agendamentos #5](https://github.com/ptrjr/medclinic-api/issues/5)            | `feat/appointments`           | Concluído (PR #14) | Validações, concorrência, posse e ciclo de status  |
| 6     | [Prontuários #6](https://github.com/ptrjr/medclinic-api/issues/6)             | `feat/medical-records`        | Concluído (PR #15) | Escrita e leitura conforme vínculo médico-paciente |
| 7     | [Publicação e evidências #7](https://github.com/ptrjr/medclinic-api/issues/7) | `ci/publicacao`               | Backlog            | Deploy automático, SSL, URL pública e entrega      |

As issues já têm descrições e critérios de aceitação. Criar um **GitHub Project público** e adicionar essas issues, com Backlog, A fazer, Em andamento, Em revisão e Concluído. Vincular cada PR ao card e mover o status durante o desenvolvimento. As ferramentas conectadas desta execução não oferecem criação de GitHub Projects ou configuração de proteção de branch; essas duas configurações ainda precisam ser feitas no GitHub.

Meta de versionamento: **20 commits reais e pelo menos 6 PRs incorporados com checks verdes**, conforme a rubrica de nota máxima. Os commits devem acompanhar mudanças reais; não criar commits vazios para preencher contagem.

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

| Caso exigido                                      | Etapa                          |
| ------------------------------------------------- | ------------------------------ |
| Login inválido e comparação por hash              | Implementado na primeira etapa |
| Cinco cenários de sobreposição de períodos        | Agendamentos                   |
| Criação válida e cinco falhas de turno/conflito   | Agendamentos                   |
| Turnos sobrepostos recusados e encostados aceitos | Implementado em Escalas        |
| Transição válida e inválida                       | Agendamentos                   |
| Prontuário com vínculo e sem vínculo              | Implementado em Prontuários    |

O recorte de cobertura inclui todos os arquivos `.service.ts` e `.rules.ts`, mesmo os novos ainda sem teste. Cada métrica precisa continuar em pelo menos 80%.

A criação de agendamentos bloqueia médico e paciente e usa apenas o EntityManager transacional. Além da verificação histórica em PGlite por TCP, a suíte de integração passou em PostgreSQL 16.15 real no Docker em 21/10/2026, observando contenção entre conexões independentes. Mocks unitários não comprovam o bloqueio transacional. Evidências e execução reproduzível: [testes de integração PostgreSQL 16](testes-integracao-postgresql.md). Antes da publicação, revisar também os cinco cenários mínimos de sobreposição em testes unitários.

## Divergências do enunciado

1. **Contagem de commits/PRs:** seção 4.7 fala em 10 commits e 3 PRs; a rubrica da seção 5 exige 20 e 6 para nota máxima. Adotamos 20/6.
2. **Escala:** o título e a tabela de erros do PUT na seção 4.9.5 indicam somente admin, mas o resumo inclui admin e doctor. A implementação segue a seção detalhada: somente admin altera, qualquer perfil autenticado lê. Confirmar a divergência com o professor antes da entrega; se doctor puder alterar, limitar à própria escala e acrescentar testes de posse.
3. **Erro 500:** RF11 exige envelope até 500, mas o catálogo não define código para falha interna. Implementamos `ERRO_INTERNO` apenas para erro inesperado e registramos o erro no servidor. Confirmar esse literal antes da entrega.
4. **Admin inicial:** o feedback anterior sugeria admin fixo na migration; RP07 da etapa final permite script de seed e exige credenciais por ambiente. O seed segue RP07, sem senha de produção versionada.

## Antes da entrega no AVA

Revisão de 19/10/2026: agendamentos incorporados pelo PR #14. Prontuários implementados sobre `806019f`, com vínculo por consultas `in_progress`/`done`, autoria pelo médico autenticado e acesso conforme RN14; incorporados pelo PR #15. Naquela etapa, a suíte registrava 384 testes e 100% nas quatro métricas de services/rules; os 42 testes novos estão em um único arquivo unitário. Foram verificadas adicionalmente 63 respostas HTTP com persistência PGlite e a migration de prontuários. Em 21/10/2026, os testes transacionais de médicos e agendamentos passaram em PostgreSQL 16.15 real, com 394 testes na suíte unitária e seis na integração. A publicação continua pendente. Evidências: [Agendamentos](verificacao-agendamentos.md), [Prontuários](verificacao-prontuarios.md) e [Integração PostgreSQL 16](testes-integracao-postgresql.md).

- [ ] Todos os endpoints da seção 4.9 implementados e conferidos literalmente.
- [ ] Casos mínimos e cobertura de pelo menos 80% nas quatro métricas.
- [ ] PRs fechados com checks verdes e commits de conteúdo real.
- [ ] Proteção da main ativa com PR obrigatório e check validate.
- [ ] Board público com evolução real dos cards e link no README.
- [ ] Workflow deploy.yml, imagem de produção e deploy automático após merge.
- [ ] Banco gerenciado com SSL, migrations e seed.
- [ ] URL pública disponível durante a correção, inclusive após inatividade.
- [ ] Login do administrador de avaliação conferido.
- [ ] README com URL, board, variáveis, arquitetura, comandos e respostas.
- [ ] Submeter repositório público, URL raiz da API, board e credenciais no AVA até 02/11/2026 às 22h.
