# Verificação de Escalas e Agenda

Base: `cd33f23` (main com PR #12 incorporado). Proposta do professor, seções 4.9.5 e 4.9.6, conferida em 19/10/2026.

## Contrato

- PUT da escala exige admin; substitui todos os turnos e aceita `shifts: []` para limpar.
- Dias de 0 a 6, horas HH:MM válidas, início anterior ao fim e duração inteira positiva.
- Sobreposição no mesmo dia retorna 400; turnos encostados ou em dias diferentes são aceitos.
- GET da escala e da agenda admite qualquer perfil autenticado; médico inexistente retorna 404.
- Agenda exige datas reais YYYY-MM-DD, ordem crescente e até 31 dias inclusivos.
- Filtro em `America/Sao_Paulo`, sem assumir deslocamento fixo; timestamps públicos em UTC.
- Resposta literal `{ workSchedule: { shifts }, appointments }`, sem geração de slots.
- Consultas canceladas são omitidas; scheduled, in_progress e done permanecem.
- Substituir/limpar a escala não altera consultas existentes (RN15).

Decisão registrada: a descrição detalhada e a tabela de erros do PUT restringem a operação a admin, enquanto o resumo também lista doctor. Foi seguida a seção detalhada; permanece a confirmação dessa divergência com o professor.

## Verificações automatizadas

- ESLint, Prettier, tipagem e build aprovados.
- 287 testes em 15 arquivos: 186 anteriores e 101 novos, separados do código de produção em `tests/`.
- Sete services e dois arquivos de regras com 100% de statements, branches, functions e lines.
- Testes unitários de turnos, datas, substituição integral e leitura da agenda usando dublês nas portas.
- Testes HTTP com o app de produção, Express em porta temporária, JWT real e repositórios substituídos por dublês.
- Casos de anonimato, três perfis, UUID inválido, DTO inválido, médico ausente, 400/401/403/404/500 e regressão das rotas de Médicos.
- Datas de 1/31/32 dias, ano bissexto, datas impossíveis, início/fim do dia e dias históricos de 23 e 25 horas em São Paulo.

Os testes HTTP não dependem de banco externo e não comprovam persistência nem concorrência por si só.

## Verificação adicional de persistência

Executada com PostgreSQL embarcado (PGlite) exposto por socket, usando o DataSource, os adaptadores TypeORM, a composição e as rotas do projeto. Não foram adicionadas dependências PGlite ao projeto.

1. Sete migrations aplicadas em banco vazio; as duas últimas revertidas vazias e reaplicadas.
2. Admin criado pelo seed; médico, secretária e paciente cadastrados pelo HTTP.
3. Escala inicialmente vazia, escrita somente por admin e leitura pelos três perfis.
4. Substituição persistida; sobreposição rejeitada sem alterar a anterior; turnos encostados aceitos.
5. Consultas inseridas diretamente pela entidade para verificar o SQL de leitura, já que POST de agendamentos pertence à próxima etapa.
6. Agenda inclui início do dia e última consulta que termina no limite final; exclui consulta iniciada no dia seguinte e consulta terminada no limite inicial.
7. Consultas de outro médico e canceladas excluídas; scheduled, in_progress e done incluídas e ordenadas.
8. Limite de 31 dias aceito, 32 recusado; 404 para médico inexistente.
9. Trigger temporário provoca falha na gravação da escala: a transação falha e a escala anterior permanece intacta.
10. Limpeza da escala mantém todos os registros de consulta e seus valores; a agenda continua exibindo as consultas existentes.
11. Reversão da migration com consultas existentes bloqueada sem perda de dados.
12. POST de agendamentos permanece 404 nesta etapa, sem implementação parcial de criação.

Limites: esta verificação comprova SQL, persistência e rollback nessa execução. Não demonstra corridas simultâneas em PostgreSQL 16. O bloqueio da linha do médico já prepara a coordenação com a futura criação de consultas; o módulo de agendamentos implementará e testará os conflitos concorrentes de médico e paciente em PostgreSQL.

## Demonstração local

Com o `.env` já preenchido e o banco local iniciado:

```bash
npm run migration:show
npm run migration:run
npm run seed:admin
npm run dev
```

Autenticar admin e usar o ID de um médico existente. Enviar o corpo da escala do README e consultar as duas rotas GET. Repetir o PUT com turnos sobrepostos, observar 400 e conferir que o GET preserva a escala anterior. Testar token de doctor no PUT (403). Enviar `shifts: []` e conferir escala vazia. Numa instalação nova, a agenda traz `appointments: []` até o módulo de agendamentos.

Histórico sugerido em três commits: modelo/migrations; regras/rotas/persistência; testes/documentação. Abrir PR ligado à issue #4 e incorporar depois do check `validate` verde.
