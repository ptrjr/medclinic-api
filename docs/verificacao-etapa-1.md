# Verificação da base — 10/10/2026

Escopo: autenticação, usuários, autorização, migrations e seed da primeira etapa do projeto final. Não representa validação dos módulos de negócio ainda pendentes.

## Checks locais

- `npm run lint`: aprovado.
- `npx eslint --fix`: configuração ativa; o lint detectou e foi corrigido um import não utilizado durante o desenvolvimento.
- `npm run format:check`: aprovado.
- `npm run typecheck`: aprovado, incluindo testes e configuração do Vitest.
- `npm run build`: aprovado.
- `npm run test:cov`: **82 testes aprovados em 6 arquivos**.
- Cobertura dos três services atuais: **100% em statements, branches, functions e lines**; 28 statements/lines, 14 branches e 7 functions.
- `git diff --check`: aprovado.

A configuração de formatação e correções ao salvar no VS Code está versionada. O atalho de salvar na instalação do aluno ainda depende das duas extensões recomendadas estarem instaladas.

## Verificação adicional de persistência e HTTP

Executada fora da suíte unitária, em um PostgreSQL via **PGlite com socket**, usando o driver PostgreSQL e os repositórios reais do TypeORM:

- Duas migrations aplicadas a um banco vazio; execução repetida sem novas migrations.
- Seed cria um admin, armazena hash bcrypt e não duplica ou troca senha ao repetir.
- Saúde, login, perfil e criação administrativa conferidos por HTTP.
- Rotas de cadastro público removidas; criação sem token recebe 401.
- Secretary não cria admin; admin autenticado pode criar outro admin.
- E-mail malformado, perfil desconhecido, campo role antigo e JSON malformado recebem 400 no envelope.
- E-mail duplicado recebe 409; token inválido recebe 401.
- DTOs de usuário não contêm senha nem hash.
- Migração de tabela antiga preserva UUID, nome, hash e data; converte perfil e e-mail.
- Reversão simples da migration de perfis funciona.
- Reversão com usuário doctor é bloqueada sem descarte dos perfis.
- Restrição CHECK rejeita perfil desconhecido diretamente no banco.
- Dois e-mails antigos que colidem ao normalizar provocam falha transacional sem perda dos registros.
- Processo de boot sem JWT_SECRET termina com código 1 e nome da variável na mensagem.

Essa verificação usa PostgreSQL/PGlite e não comprova a imagem Docker, SSL com o provedor de produção ou comportamento de concorrência de agendamento. Esses itens serão verificados nas respectivas entregas. Nenhuma dependência de PGlite foi adicionada ao projeto.

## Evidência de CI

O workflow de PR está incluído. A execução remota deve ser conferida na aba Checks do primeiro PR; este relatório registra os resultados locais e a verificação adicional, sem antecipar o resultado do GitHub Actions.
