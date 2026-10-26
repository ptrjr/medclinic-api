# Publicação automática no Render

Este guia prepara uma publicação de produção sem colocar credenciais no repositório.
O workflow [deploy.yml](../.github/workflows/deploy.yml) só executa quando há push na
`main`: publica uma imagem Linux `amd64` no GitHub Container Registry (GHCR) e pede ao
Render que implante o **digest** daquela imagem. Pull requests não fazem deploy.

O deploy só é acionado quando a variável **de repositório** `RENDER_DEPLOY_ENABLED`
vale exatamente `true`. Sem essa ativação, somente a imagem é publicada, e o resumo
do workflow informa que o deploy está desativado. Isso permite criar o serviço Render
depois que sua imagem existe, sem depender de um hook ainda inexistente.

Enquanto os recursos abaixo não forem configurados e a primeira execução não terminar
com sucesso, a API não deve ser declarada como pública no README.

## 1. Criar a primeira imagem no GHCR

Mantenha `RENDER_DEPLOY_ENABLED` ausente ou com valor `false`. Após os checks do PR
passarem, incluindo `docker build` sem publicação, incorpore o PR na `main`.
O job `publish image` deve passar, e `deploy Render` deve aparecer como **skipped**.
Esse resultado comprova a publicação da imagem, não um deploy da API.

Abra o pacote `medclinic-api` no GitHub Packages e confirme que a imagem está
disponível. O workflow autentica com `GITHUB_TOKEN` e permissão `packages: write`.
Se a publicação falhar por permissão, resolva a configuração do pacote/repositório
antes de prosseguir.

## 2. Banco gerenciado

No Render, crie PostgreSQL 16 na mesma região do futuro Web Service. Guarde as
credenciais somente no painel do Render. Para atender à conexão com TLS, use os dados
de conexão **externa** do banco no serviço e configure:

| Variável no Render | Valor                                    |
| ------------------ | ---------------------------------------- |
| `DB_HOST`          | host da URL externa, sem `postgresql://` |
| `DB_PORT`          | porta da URL externa                     |
| `DB_USERNAME`      | usuário da URL externa                   |
| `DB_PASSWORD`      | senha da URL externa                     |
| `DB_DATABASE`      | nome do banco da URL externa             |
| `DB_SSL`           | `true`                                   |

O driver valida o certificado (`rejectUnauthorized: true`). Não use `sslmode=disable`
nem altere o código para aceitar certificados inválidos. O Render informa que conexões
externas ao PostgreSQL são protegidas por certificados TLS gerenciados; a conexão
interna oferece TLS opcional com certificado autoassinado, por isso não é o caminho
usado por esta configuração.

Defina também no painel do serviço:

```text
JWT_SECRET=<valor aleatório com pelo menos 32 caracteres>
JWT_EXPIRES_IN=1d
ADMIN_NAME=Administrador
ADMIN_EMAIL=<e-mail exclusivo para a avaliação>
ADMIN_PASSWORD=<senha forte para a avaliação>
```

Não reutilize credenciais locais e não inclua esses valores em `.env.example`, commits,
issues, README ou Pull Requests. O container executa migrations e o seed idempotente
antes de iniciar o servidor; o seed não substitui a senha de um administrador já
existente.

## 3. Serviço a partir da imagem existente

Crie um **Web Service** no Render com a opção **Existing Image** e configure como imagem
inicial:

```text
ghcr.io/ptrjr/medclinic-api:latest
```

O pacote já deve existir após a etapa 1. A opção preferida é
manter o pacote privado: crie uma credencial de registry no Render com o usuário do
GitHub e um personal access token **classic** com permissão
`read:packages`. Essa credencial fica somente no Render. Se o pacote for tornado
público nas configurações do GitHub Packages, o Render pode buscá-lo sem credencial.

Mantenha o `PORT` fornecido pelo Render; a aplicação escuta `0.0.0.0` e respeita essa
variável. Configure o health check do serviço como:

```text
/api/v1/health
```

Depois do primeiro deploy, copie o **Deploy Hook** em _Settings_ do serviço. No GitHub,
adicione-o como o secret de repositório `RENDER_DEPLOY_HOOK_URL` em _Settings > Secrets
and variables > Actions_. O hook é segredo: não o coloque em arquivos versionados.

## 4. Ativar e comprovar a automação

Depois de configurar o secret, crie a variável **de repositório**
`RENDER_DEPLOY_ENABLED` com valor `true`, em _Settings > Secrets and variables >
Actions > Variables_. Ela não é um secret e deve estar no escopo do repositório,
pois é consultada antes de iniciar o job associado ao environment `production`.

Com a ativação, o job `deploy` falha intencionalmente se o secret não existir. Uma imagem pode
ser publicada, mas o workflow jamais sinaliza um deploy de produção que não foi
acionado. Ao receber o hook, ele envia `imgURL` com o digest publicado, evitando que o
Render implante uma tag `latest` alterada por outra execução.

Para conferir a automação sem alterar código, abra a primeira execução do workflow
**Publish and deploy production**, na aba Actions, e selecione **Re-run all jobs**.
A nova tentativa publica a imagem e avalia a variável atual para acionar o hook.
Os próximos merges na `main` acionam esse fluxo automaticamente.

O sucesso do hook confirma que o Render aceitou a solicitação, não que o deploy
terminou. Confira no painel Render o estado **Live** e o digest implantado, e então
verifique saúde e login HTTP. Não declare publicação concluída apenas pelo job verde.

Com a URL pública em mãos, execute:

```bash
curl --fail https://SUA-URL.onrender.com/api/v1/health
```

O resultado esperado é:

```json
{ "status": "ok" }
```

Faça também login pela URL pública com o administrador configurado no painel, sem
registrar a senha em evidências públicas. Registre no README somente a URL pública,
o método de verificação e credenciais de avaliação entregues de forma privada pelo AVA.

## Garantias e responsabilidades

| Item                             | Onde é garantido                                                    |
| -------------------------------- | ------------------------------------------------------------------- |
| Imagem multi-stage Linux `amd64` | `Dockerfile` e job `publish image`                                  |
| Publicação após merge na `main`  | gatilho `push` de `deploy.yml`                                      |
| Solicitação de implantação       | variável de ativação e deploy hook Render com digest imutável       |
| Migrations e seed                | `docker/start.sh` no boot do container                              |
| Banco gerenciado com TLS         | URL externa Render e `DB_SSL=true`                                  |
| Segredos fora do Git             | Render Environment, GitHub Actions Secrets e credencial de registry |

Os checks de qualidade e integração PostgreSQL 16 continuam no workflow de Pull
Request. O workflow de produção não substitui esses checks; a proteção de branch deve
exigir `validate`, `integration (PostgreSQL 16)` e `docker build` antes do merge.

Validação da imagem, conexão TLS no provedor e publicação pública só são comprovadas
pelas execuções reais correspondentes. Este guia não as declara concluídas.
