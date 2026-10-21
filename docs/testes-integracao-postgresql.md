# Testes transacionais em PostgreSQL 16

Base da implementação: `origin/main` em `7c8359950572339257409e2eec4cff83955ab9c3` (PR #15).

## Executar localmente

Requisitos: Node.js nas versões aceitas pelo projeto, `npm ci` e Docker com Compose.
Este Compose é separado do ambiente de desenvolvimento, usa porta 5433 vinculada
somente a `127.0.0.1` e armazena os dados em `tmpfs`, sem volume persistente:

```bash
docker compose -p medclinic-integration -f compose.integration.yaml up -d --wait
```

Se a porta 5433 estiver ocupada, defina `INTEGRATION_DB_PORT` com outra porta livre
**antes** do `up` e use o mesmo valor ao executar a suíte. O Compose publica essa
porta, mantendo a porta interna do PostgreSQL em 5432.

Configure **todas** as variáveis explícitas da suíte. No bash:

```bash
export INTEGRATION_DB_HOST=127.0.0.1
export INTEGRATION_DB_PORT=5433
export INTEGRATION_DB_USERNAME=integration
export INTEGRATION_DB_PASSWORD=integration-only-password
export INTEGRATION_DB_DATABASE=medclinic_integration_test
npm run test:integration
```

No PowerShell:

```powershell
$env:INTEGRATION_DB_HOST = '127.0.0.1'
$env:INTEGRATION_DB_PORT = '5433'
$env:INTEGRATION_DB_USERNAME = 'integration'
$env:INTEGRATION_DB_PASSWORD = 'integration-only-password'
$env:INTEGRATION_DB_DATABASE = 'medclinic_integration_test'
npm.cmd run test:integration
```

Ao terminar, inclusive se o comando de testes falhar:

```bash
docker compose -p medclinic-integration -f compose.integration.yaml down
```

Também é possível usar uma instância PostgreSQL 16 local própria, desde que o banco
**exclusivo e descartável** tenha exatamente o nome `medclinic_integration_test`.
`INTEGRATION_DB_HOST` aceita somente `127.0.0.1`, `::1` ou `localhost`. O alias
`localhost` é convertido em `127.0.0.1` antes de criar o DataSource, sem resolução
DNS. Outros IPs, nomes de servidores, URLs e sockets Unix são recusados; não há
opção para liberar hosts externos. Compose e GitHub Actions usam `127.0.0.1`.
O usuário precisa criar/remover objetos no schema `public`, consultar a atividade
das próprias conexões e executar as migrations. As credenciais acima são somente
para o container de testes. O schema `public` desse banco é apagado no início e no
fim da suíte; não coloque dados a preservar nesse banco.

## Proteção e ciclo de vida

- `tests/integration/config.ts` exige as cinco variáveis `INTEGRATION_DB_*`, sem
  carregar `.env`, importar o DataSource de produção ou herdar qualquer `DB_*`.
  Nome ausente ou diferente e host fora da lista de loopback são recusados antes
  de criar o DataSource ou abrir qualquer conexão. Essa restrição impede apontar
  diretamente para outro servidor que também tenha um banco com o nome esperado.
  Mantenha a porta local ligada ao banco descartável: a validação de host não
  identifica um servidor remoto acessível por um túnel ou proxy local.
- Depois de conectar, a suíte verifica `current_database()` e a versão do servidor
  antes de migrations ou alterações de schema. Somente PostgreSQL 16 é aceito.
  O DataSource usa a factory real, com `synchronize: false`.
- Um advisory lock de sessão reserva o banco durante toda a execução. Uma segunda
  suíte concorrente falha sem limpar dados da primeira. O nome configurado e o nome
  real são reconferidos antes de limpeza e instalação/remoção dos triggers.
- A suíte recria `public`, aplica as oito migrations reais e inicializa o Express
  por `composeApplication`, com TypeORM, bcrypt e JWT reais. O servidor escuta em
  `127.0.0.1`, numa porta atribuída pelo sistema operacional.
- Cada cenário recebe admin via `AdminSeedService` e login HTTP real. Médicos,
  pacientes e escalas são preparados pelas rotas da aplicação. As tabelas são
  esvaziadas entre testes, preservando as migrations até o fim da execução.
- Blocos `finally` liberam os bloqueios e aguardam as requisições pendentes antes
  de remover os objetos temporários. Hooks encerram o servidor, removem o schema,
  liberam o lock de sessão e fecham o pool mesmo em falhas de asserção ou boot.
  Requisições, conexão, consultas e observação têm limites de tempo. Se o processo
  for encerrado à força, a próxima execução recria o schema, e o Compose `down`
  descarta o armazenamento do container.

Os testes de proteção em `tests/integration-config.test.ts` executam sem banco na
suíte normal e verificam nomes recusados, ausência de fallback para `DB_*`, hosts
locais aceitos, normalização de `localhost` sem DNS e rejeição de hosts externos
mesmo com o nome correto do banco.

## Garantias e coordenação

| Cenário                            | Evidência verificada                                                                                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cadastro de médico                 | HTTP 201, usuário com perfil doctor, hash persistido, ausência de senha na resposta e login HTTP 200 com as credenciais fornecidas.                                                      |
| Falha no INSERT de médico          | Trigger vê o usuário dentro da transação, registra a passagem e lança exceção. HTTP 500, nenhum médico ou usuário órfão e login 401.                                                     |
| Corrida pelo mesmo CRM             | Ambas as transações chegam ao INSERT de médico depois do pré-check. A constraint `doctors_crm_unique` produz um 201 e um 409 `CRM_JA_CADASTRADO`; só o vencedor e seu usuário persistem. |
| Mesmo médico e horário             | Duas conexões HTTP bloqueadas na linha do médico antes da liberação; um 201, um 409 `HORARIO_INDISPONIVEL` e exatamente uma consulta persistida.                                         |
| Mesmo paciente, médicos diferentes | Duas conexões HTTP bloqueadas na linha do paciente antes da liberação; um 201, um 409 `PACIENTE_INDISPONIVEL` e exatamente uma consulta persistida.                                      |
| Intervalos encostados              | Mesmo médico e paciente recebem duas consultas 201; o fim da primeira é igual ao início da segunda no banco.                                                                             |

Nos agendamentos, uma conexão de controle independente abre transação e bloqueia a
linha disputada com `SELECT ... FOR UPDATE`. Duas requisições HTTP são iniciadas;
uma conexão observadora consulta `pg_stat_activity` e `pg_blocking_pids`. A suíte
exige dois PIDs distintos com estado ativo e espera por lock, cuja cadeia de
bloqueadores chega ao PID da conexão de controle. Só então libera a transação de
controle e confere as respostas e os registros persistidos. Os próprios bloqueios
da aplicação serializam a validação e gravação após essa liberação.

Na corrida de CRM, o trigger temporário `integration_doctor_insert` espera por um
advisory lock transacional retido pela conexão de controle. Assim, os dois
pré-checks encontram o CRM livre e os dois INSERTs chegam ao trigger antes de
qualquer commit. A observação exige os dois PIDs bloqueados executando o INSERT
real em `doctors`. Depois da liberação, a constraint decide o vencedor. Uma
sequência temporária registra que ambos já viram o respectivo usuário inserido;
`nextval` sobrevive ao rollback, permitindo verificar esse ponto também no cenário
de falha forçada. O trigger confere o nome real do banco antes de agir. Trigger,
função e sequência são removidos em `finally`, além da limpeza final do schema.

Não há mocks de repositório, transação ou lock. O polling cede execução ao event
loop com `setImmediate` e termina pela condição observada ou pelo timeout; não há
sleeps arbitrários nem suposição de que `Promise.all` comprova contenção. Em caso
de timeout, o erro inclui os PIDs, bloqueadores e consultas observados.

## Suítes e CI

`npm test` e `npm run test:cov` continuam independentes de PostgreSQL e incluem os
testes de service/HTTP com dublês. O recorte de cobertura permanece exatamente
`src/**/*.service.ts` e `src/**/*.rules.ts`, com os mesmos limiares de 80% nas
quatro métricas. Os arquivos `.integration.ts` só são selecionados por
`vitest.integration.config.mts` e pelo comando `npm run test:integration`.

As verificações anteriores documentadas para Médicos e Agendamentos usaram PGlite
por TCP. São evidência histórica do SQL e da persistência, mas não comprovam a
execução em PostgreSQL 16. Esta suíte exige um servidor PostgreSQL 16 real e
observa a espera por locks entre conexões independentes.

O workflow de PR mantém o job `validate` com lint, formatação, tipagem, build e
cobertura. O job adicional `integration (PostgreSQL 16)` usa o serviço
`postgres:16`, aguarda o health check `pg_isready`, instala dependências e executa
a suíte. A conexão e a verificação da versão no harness precedem as migrations.
Não há dependências npm adicionais.

## Validação local em 21/10/2026

- `git fetch origin`: base `7c8359950572339257409e2eec4cff83955ab9c3`, checkout
  limpo; branch `test/postgres16-transactional` criada dessa referência.
- `docker compose -p medclinic-integration -f compose.integration.yaml up -d --wait`:
  serviço saudável com `INTEGRATION_DB_PORT=55433`, pois a porta 5433 estava ocupada.
- `SELECT version()`: PostgreSQL **16.15**, imagem oficial `postgres:16`, Linux x86_64.
- `npm run test:integration`: **6 testes aprovados**, incluindo as três disputas
  com observação de bloqueio (CRM, médico e paciente).
- `npm run test:cov`: **394 testes aprovados em 19 arquivos**, sendo 384 anteriores
  e 10 de proteção da configuração. Cobertura de services/rules: **100%** em
  statements (241/241), branches (144/144), functions (58/58) e lines (229/229).
- `npm run lint`, `npm run format:check`, `npm run typecheck` e `npm run build`:
  aprovados.
- Após a suíte, consulta externa ao banco confirmou zero tabelas/funções no schema
  `public` e zero conexões com o prefixo `medclinic-integration-`.
- `docker compose -p medclinic-integration -f compose.integration.yaml down`:
  container e rede removidos ao final da validação.

Os comandos npm foram executados com `npm.cmd` no Windows. O Vitest precisou da
execução fora do sandbox para criar subprocessos, após uma tentativa bloqueada
com `spawn EPERM`. Não houve substituição por PGlite. O workflow foi preparado
localmente; a execução no GitHub Actions depende de um futuro push/PR autorizado.

### Revalidação da proteção de loopback em 21/10/2026

A restrição de host acrescentou 18 casos sem banco (quatro entradas locais e 14
hosts inválidos ou externos), mantendo os dez testes anteriores de configuração.
`npm run test:cov` passou com **412 testes em 19 arquivos** e **100% nas quatro
métricas** do mesmo recorte de services/rules. Lint, formatação, typecheck e build
também passaram. `npm run test:integration` aprovou os mesmos **seis cenários** em
PostgreSQL **16.15** real, com o container descartável acessado por
`127.0.0.1:55433`. Compose e job do GitHub Actions já usam loopback e não precisaram
de mudanças, assim como o harness e os cenários de integração.
