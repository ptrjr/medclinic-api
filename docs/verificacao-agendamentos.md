# Verificação do módulo de Agendamentos

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

- Testes de service e regras usam dublês; não são prova de SQL.
- O cenário de persistência e concorrência usa PGlite PostgreSQL-compatível, sem alegar que é PostgreSQL 16.
- A migration que cria a tabela `appointments` já foi incorporada na etapa de Escalas e Agenda (PR #13); este módulo usa essa tabela e não adiciona outra migration.
- Revisar este módulo no PR e incluir `Closes #5` na descrição para rastrear a issue de Agendamentos.
