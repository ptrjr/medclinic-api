# Verificação de Prontuários

Contrato: RN14, RF09, RF10, RF12 e seção 4.9.8 da proposta do professor. Base: `806019f`, merge do PR #14. Branch: `feat/medical-records`.

## Regras implementadas

- Médico com ao menos um atendimento `in_progress` ou `done` para o paciente pode escrever e ler.
- Médico sem vínculo não escreve nem lê. Consulta `scheduled` ou `cancelled` não concede vínculo.
- Admin lê para auditoria; admin sem perfil doctor não escreve. Secretary sem outro perfil autorizado não acessa.
- Autoria obtida por `DoctorRepository.findByUserId` usando o usuário autenticado. `doctorId` enviado no corpo é ignorado, sem validar nem confiar no seu valor.
- Leitura autorizada inclui registros de outros médicos do mesmo paciente. O paciente é sempre o da rota.
- Paciente inexistente ou removido logicamente retorna 404 para perfis autorizados; exclusão lógica preserva os registros no banco.
- Texto obrigatório; listagem paginada em `data/meta`, ordenada por `createdAt DESC, id DESC`; DTO de resposta sem credenciais.

## Testes unitários e checks

Os 42 testes novos estão em `tests/medical-record.unit.test.ts`, com dublês sobre as portas de repositório. Esses testes não dependem de banco, rede nem variável de ambiente.

| Verificação                 | Resultado                                       |
| --------------------------- | ----------------------------------------------- |
| `npm run lint`              | Aprovado                                        |
| `npm run format:check`      | Aprovado                                        |
| `npm run typecheck`         | Aprovado                                        |
| `npm run build`             | Aprovado                                        |
| `npm run test:cov`          | 384 testes aprovados em 18 arquivos             |
| Cobertura de services/rules | 100% em statements, branches, functions e lines |

O recorte contém nove services e três arquivos de regras; controllers, migrations, configuração e adaptadores ficam fora da porcentagem. A cobertura de service com dublês não comprova as consultas SQL.

## Verificação adicional com persistência

Foi executado um diagnóstico fora da suíte unitária usando a composição real da API, JWT, repositórios TypeORM, oito migrations e PGlite servido por TCP. Foram conferidas 63 respostas HTTP, incluindo login/cadastros de preparação e os casos abaixo.

| Cenário                                                              | Resultado observado                                             |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Ausência de token / token inválido                                   | 401 `NAO_AUTENTICADO`                                           |
| Admin tentando escrever; secretary lendo/escrevendo                  | 403 `ACESSO_NEGADO`                                             |
| Médico sem consulta, com consulta scheduled ou cancelled             | 403 `ACESSO_NEGADO`                                             |
| Médico com consulta in_progress ou done                              | Escrita 201 e leitura 200                                       |
| Outro doctorId enviado no corpo, inclusive um objeto inválido        | Ignorado; resposta e banco mantêm o médico do token             |
| Outro médico sem vínculo tentando usar o autor alheio                | 403 `ACESSO_NEGADO`                                             |
| Médico com vínculo lendo registros de outro autor do mesmo paciente  | 200, com os registros do paciente                               |
| Paciente inexistente, UUID inválido, texto vazio, paginação inválida | 404 ou 400 com o código correspondente                          |
| Query tentando trocar o paciente da rota                             | Acesso negado ao paciente sem vínculo                           |
| Paginação e empate de timestamps                                     | Total/páginas corretos; ordem estável `createdAt DESC, id DESC` |
| Cancelar o único atendimento qualificante                            | Vínculo deixa de conceder leitura/escrita                       |
| Texto contendo apóstrofo e caracteres SQL                            | Persistido como dado por consulta parametrizada                 |
| Exclusão lógica do paciente                                          | API retorna 404; registros continuam no banco                   |
| Migration vazia revertida e reaplicada                               | Concluída                                                       |
| Reversão da migration com prontuários                                | Bloqueada; dados e migration preservados                        |
| Inserção SQL de texto vazio ou paciente inexistente                  | Restrição CHECK / chave estrangeira recusa                      |

Esse diagnóstico usa PostgreSQL-compatível PGlite, **não PostgreSQL 16**. Ele acrescenta evidência de SQL e HTTP, mas a execução final no banco exigido ainda está pendente para a etapa de publicação.

## Conferência local com PostgreSQL

Depois de aplicar o patch e subir o banco, execute `npm run migration:run`. Autentique admin, secretary e dois médicos com usuários distintos. Cadastre paciente e escala; agende uma consulta e confirme que seu status inicial `scheduled` ainda não concede acesso ao prontuário. Inicie a consulta com `PATCH /api/v1/appointments/:id/status` e `{"status":"in_progress"}`. O médico dono poderá escrever e ler; o outro médico continuará recebendo 403. Admin poderá ler e receberá 403 ao escrever.

Ao escrever, envie também `doctorId` do segundo médico e confira que a resposta mantém o primeiro. Finalize o atendimento com `done` e confirme que o vínculo continua válido. Confira a paginação e depois a remoção lógica do paciente: futuras requisições autorizadas retornam 404, preservando o histórico no banco. Registre essa execução em PostgreSQL 16 antes da entrega final.
