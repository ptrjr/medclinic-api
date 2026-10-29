# Verificação do módulo de Agendamentos

## Revisão da sobreposição — 28/10/2026

Branch `fix/etapa-1-sobreposicao-agendamentos`, baseada na `main` local em
`1eb496be39370d2f2a84334dc556093011ca82cd`, igual à referência local `origin/main`.
Uma consulta somente de leitura com `git ls-remote origin refs/heads/main`
confirmou o mesmo hash na `main` remota.
Árvore inicialmente limpa; nenhum `AGENTS.md` aplicável encontrado. Não houve
fetch, commit, push, merge, deploy ou alteração remota nesta revisão.

A lacuna foi confirmada: os testes anteriores simulavam booleanos de
`hasDoctorConflict`/`hasPatientConflict`, e a comparação real existia somente no
SQL. A porta transacional agora retorna períodos candidatos por médico/paciente.
O repositório conserva os filtros parametrizados por titular, janela e status
diferente de `cancelled`, selecionando os campos de período. O service executa
`periodsOverlap`, de `appointment-schedule.rules.ts`, com a condição:

```typescript
a.startsAt < b.endsAt && b.startsAt < a.endsAt;
```

A regra é usada pela aplicação antes de qualquer gravação, primeiro para médico
e depois para paciente. Leitura de escala/candidatos, validação e inserção seguem
no mesmo contexto transacional, com bloqueio pessimista de médico e paciente na
ordem original. O cálculo de `endsAt`, a escala, as respostas e os códigos HTTP
permanecem os mesmos. Não foram alterados dependências, migrations, recorte ou
limiares de cobertura, nem as proteções do banco de integração.

Os 20 novos casos em `tests/appointment.unit.test.ts` executam o service com a
regra real, sem banco externo. Para cada titular, cobrem nove posições relativas
e uma lista com um período livre seguido de um conflitante:

| Posição do período existente em relação ao novo | Conflita? |
| ----------------------------------------------- | --------- |
| Completamente antes ou depois                   | Não       |
| Encostado no início ou no fim                   | Não       |
| Contido no novo ou contendo o novo              | Sim       |
| Cruzando o início ou o fim                      | Sim       |
| Igual                                           | Sim       |

Cada conflito verifica que `create` não é chamado. O teste de prioridade fornece
períodos conflitantes para ambos e exige o erro do médico antes de consultar o
paciente. Dublês e testes HTTP foram adaptados para retornar períodos, sem
implementar a comparação. A integração acrescenta duas matrizes pela composição
real, verificando os mesmos limites, filtros por titular, ocupação de consultas
`scheduled`/`in_progress`/`done` e exclusão de `cancelled`.

`npm run test:cov` aprovou **432 testes em 19 arquivos**, com **100%** em statements
(247/247), branches (146/146), functions (61/61) e lines (233/233). A primeira
tentativa foi bloqueada pelo sandbox com `spawn EPERM`; a execução fora dele
passou. A integração usa PostgreSQL 16 real; evidências por execução em
[testes de integração PostgreSQL 16](testes-integracao-postgresql.md).

Também passaram `npm run lint`, `npm run format:check`, `npm run typecheck`,
`npm run build` e `git diff --check`. A integração aprovou **8 testes** em
PostgreSQL **16.15**. Ao final, o banco ficou sem tabelas/funções no schema
`public` e sem conexões da suíte; o container e a rede descartáveis foram removidos.

Esta revisão não comprova publicação, board, proteção da `main` nem validação
pública. Abaixo permanece o registro histórico da implementação inicial.

## Implementação inicial — registro histórico

Branch de trabalho: `feat/appointments`, baseada no commit `a46a855` (PR #13 incorporado à `main`).

## Testes automatizados

- Testes unitários do módulo reunidos em `tests/appointment.unit.test.ts`.
- Testes HTTP em `tests/appointment.http.test.ts`, usando servidor Express temporário, JWT real e dublês nas portas.
- Cobertura global: 342 testes em 17 arquivos; 100% em statements, branches, functions e lines para services/rules.
- Cobertos: cálculo de fim pelo turno e fuso da clínica; horário fora da escala, não alinhado ou que ultrapassa o turno; criação válida e falhas de recurso/escala/conflito; filtros e paginação; posse por médico; matriz de transições; entrada inválida e respostas de erro centralizadas.

Comandos de verificação:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run build
npm run test:cov
```

Resultado nesta etapa: todos aprovados; `test:cov` reportou 342 testes e cobertura de 100% nas quatro métricas consideradas.

## Verificação transacional com banco PostgreSQL-compatível

Além dos dublês, a persistência TypeORM foi exercitada via HTTP com migrations aplicadas em PGlite servido por TCP. O cenário confirmou gravação real de `endsAt`, listagem e filtros, detalhe e posse, transições, cancelamento que libera o horário, e preservação de consultas depois de limpar a escala.

Foram testadas as quatro formas de interseção de intervalos: mesmo início, novo período começando antes e terminando dentro, começando dentro e terminando depois, e período existente contendo o novo. Dois períodos que somente encostam foram aceitos. Duas requisições simultâneas para o mesmo médico produziram exatamente uma resposta **201** e uma **409**; a mesma propriedade foi verificada para o mesmo paciente atendido por médicos diferentes.

O bloqueio usa uma transação TypeORM, trava primeiro a linha do médico e depois a do paciente e mantém consultas, validações e inserção no `EntityManager` transacional. Esse teste com PGlite é evidência adicional do comportamento SQL e da corrida, mas não substitui a execução em PostgreSQL 16. A validação final com a versão do banco exigida no projeto ainda deve ocorrer no ambiente Docker/CI ou de publicação.

## Limites e próximos passos

Atualização de 21/10/2026: a nova suíte `npm run test:integration` passou em PostgreSQL 16.15 real no Docker. Observa os PIDs bloqueados antes de liberar as disputas por médico e por paciente e confere respostas HTTP, persistência e intervalos encostados. Instruções e resultados em [testes de integração PostgreSQL 16](testes-integracao-postgresql.md). Os resultados PGlite acima são o registro histórico da etapa anterior.

- Testes de service e regras usam dublês; não são prova de SQL.
- O cenário de persistência e concorrência usa PGlite PostgreSQL-compatível, sem alegar que é PostgreSQL 16.
- A migration que cria a tabela `appointments` já foi incorporada na etapa de Escalas e Agenda (PR #13); este módulo usa essa tabela e não adiciona outra migration.
- Revisar este módulo no PR e incluir `Closes #5` na descrição para rastrear a issue de Agendamentos.
