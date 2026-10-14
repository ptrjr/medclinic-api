# Verificação do módulo de Médicos

Base: `c1e501e` (main com o PR #10 incorporado). Referência: seção 4.9.4 do README do professor, conferida em 13/10/2026.

## Contrato implementado

- `POST /api/v1/doctors`: admin, 201 com `{ id, crm, user }`.
- `GET /api/v1/doctors`: qualquer usuário autenticado, filtros `page`, `pageSize`, `name`, resposta `{ data, meta }`.
- `GET /api/v1/doctors/:id`: qualquer usuário autenticado, 200/404; UUID inválido recebe 400.
- Usuário criado com `roles: ["doctor"]`; senha armazenada com bcrypt e ausente nas respostas.
- E-mail e CRM únicos, inclusive em corrida entre pré-check e gravação; 409 com o código correspondente.

## Verificações executadas

- ESLint, Prettier, tipagem estrita e build.
- 129 testes automatizados: 88 anteriores e 41 novos em service/HTTP de Médicos.
- Service de Médicos: 100% em statements, branches, functions e lines.
- Suíte total: 98,59% statements, 92,5% branches, 100% functions e lines; o recorte permanece services/rules.

Os testes HTTP usam um Express real em porta temporária, JWT real e dublês na porta de repositório. Cobrem os três perfis, anonimato, corpo inválido, ausência de senha, 409/404, defaults e limites da paginação, query por nome e o formato literal `data/meta`.

## Verificação adicional do banco

Executada em PostgreSQL embarcado (PGlite) exposto por socket, com o DataSource e adaptador TypeORM do projeto. Não foram adicionadas dependências PGlite ao projeto.

1. As quatro migrations aplicadas em banco vazio; migration de médicos revertida vazia e reaplicada.
2. Cadastro HTTP seguido de login do novo médico; bcrypt verificado no banco.
3. CRM repetido com e-mail novo retorna 409 e o login do e-mail novo retorna 401.
4. Adaptador chamado diretamente para forçar falha no UNIQUE de CRM depois do INSERT de usuário: transação reverte o usuário.
5. Conflito de e-mail no adaptador devolve o código correto, inclusive com o nome de constraint gerado pelo TypeORM na base antiga.
6. Trigger temporário provoca falha inesperada no INSERT de médico: usuário também é desfeito.
7. Listagem por nome, paginação, detalhe e campos públicos conferidos contra dados reais; caracteres `%` são tratados literalmente no filtro.
8. Reversão com médicos existentes bloqueada e dados preservados.

Limite: essa execução comprova o SQL e o rollback, mas não substitui a demonstração posterior em PostgreSQL 16 do Docker e no banco gerenciado da publicação.

## Demonstração local sugerida

Rodar `npm run migration:run`, iniciar a API e autenticar como admin. Criar a médica com o corpo do README e conferir o login dela. Repetir o CRM com e-mail novo, observar `409 CRM_JA_CADASTRADO` e confirmar que esse e-mail não autentica (`401 CREDENCIAIS_INVALIDAS`). Consultar a lista com `pageSize=1&name=helena`; conferir `data` e `meta`.

Manter o histórico em três commits: modelo/migration, cadastro/consultas, testes/documentação. Abrir PR ligado à issue #3 e incorporar somente após o check `validate` verde.
