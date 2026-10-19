# Correção do contrato de Pacientes

Base: main `771b130`, com Médicos incorporado pelo PR #11. Contrato: seção 4.9.3 da proposta, conferida em 13/10/2026.

## Correções

| Antes                                                                | Agora                                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Cadastro exigia nascimento/telefone e validava dígitos verificadores | Cadastro com name/cpf; formato literal de 11 dígitos, aceitando o exemplo 12345678901 |
| CPF pontuado era transformado em dígitos                             | CPF pontuado, com espaços ou letras retorna 400 DADOS_INVALIDOS                       |
| GET bloqueava doctor                                                 | Qualquer perfil autenticado consulta lista e detalhe                                  |
| DELETE permitia secretary                                            | Somente admin exclui                                                                  |
| Filtro search e resposta items/total                                 | Filtro name e resposta data/meta com totalPages                                       |
| PATCH permitia trocar CPF e outros campos                            | PATCH altera apenas name                                                              |
| Exclusão física                                                      | Exclusão lógica; consultas ignoram removidos e CPF continua reservado                 |

## Banco

As migrations anteriores permanecem intactas. A quinta migration torna birth_date/phone anuláveis e adiciona deleted_at. Os dados antigos, IDs, CPF e createdAt são preservados. O domínio/DTO deixam de depender dos campos legados; as colunas permanecem armazenadas.

A reversão é permitida quando todos os pacientes têm os campos legados preenchidos e ninguém foi removido. Caso contrário, ela é bloqueada antes de alterar qualquer coluna, evitando perda de dados ou reativação silenciosa de pacientes.

## Testes executados

- ESLint, formatação, tipagem e build.
- 186 testes aprovados; os cinco services têm 100% em statements, branches, functions e lines.
- Os testes HTTP de Pacientes exercitam Express e JWT reais com dublês de repositório: anonimato, perfis, cadastro mínimo do enunciado, CPF inválido/duplicado, name/page/pageSize, resposta data/meta, PATCH e DELETE 204 sem corpo.
- Testes de service verificam duplicidade concorrente, ausência do recurso e remoção concorrente antes de atualização/exclusão.
- Testes de Médicos, autenticação e usuários continuam na suíte e passaram.

## Verificação adicional de SQL

Executada com PostgreSQL embarcado (PGlite) por socket, DataSource/TypeORM do projeto e chamadas HTTP com persistência real. Não foi adicionada dependência ao package.json.

1. Aplicadas as quatro migrations antigas e inserido paciente com os campos legados; quinta migration preservou os dados.
2. Rollback da quinta migration permitido com dados legados completos; migration reaplicada.
3. Cadastro somente com name/cpf via secretary devolveu 201 e os quatro campos do contrato.
4. CPF fictício literal aceito; CPF pontuado, alfabético ou com espaço recusado com 400; duplicidade com 409.
5. Admin, secretary e doctor leram lista/detalhe; doctor foi bloqueado no cadastro/PATCH e secretary na exclusão.
6. Filtro parcial case insensitive, paginação data/meta e caracteres de busca tratados literalmente.
7. PATCH atualizou nome preservando CPF e createdAt.
8. Exclusão lógica retornou 204 sem corpo; detalhe/lista ocultaram removido; nova exclusão retornou 404. Linha permaneceu no banco com deleted_at preenchido.
9. Tentativa de reutilizar CPF removido retornou 409. UPDATE/DELETE concorrentes de linha removida não a reativaram.
10. Rollback com cadastro mínimo/removido foi bloqueado, preservando as linhas.

Limite: PGlite verifica SQL, upgrade e persistência; demonstração em PostgreSQL 16 do Docker e banco gerenciado continua necessária antes da entrega.
