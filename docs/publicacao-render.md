# Publicação automática no Render

Este guia prepara uma publicação de produção sem colocar credenciais no repositório.
O workflow [deploy.yml](../.github/workflows/deploy.yml) só executa quando há push na
`main`: publica uma imagem Linux `amd64` no GitHub Container Registry (GHCR) e pede ao
Render que implante o **digest** daquela imagem. Pull requests não fazem deploy.

Enquanto os recursos abaixo não forem configurados e a primeira execução não terminar
com sucesso, a API não deve ser declarada como pública no README.

## 1. Banco gerenciado

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

## 2. Serviço a partir da imagem

Crie um **Web Service** no Render com a opção **Existing Image** e configure como imagem
inicial:

```text
ghcr.io/ptrjr/medclinic-api:latest
```

O GHCR cria o pacote na primeira execução bem-sucedida do workflow. A opção preferida é
manter o pacote privado: crie uma credencial de registry no Render com o usuário do
GitHub e um personal access token **classic** limitado ao pacote, com permissão
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

O job `deploy` falha intencionalmente se esse secret não existir. Assim, uma imagem pode
ser publicada, mas o workflow jamais sinaliza um deploy de produção que não foi
acionado. Ao receber o hook, ele envia `imgURL` com o digest publicado, evitando que o
Render implante uma tag `latest` alterada por outra execução.

## 3. Primeira execução e conferência

Antes de incorporar este workflow na `main`, confirme que o repositório permite ao
`GITHUB_TOKEN` gravar packages. Após o merge, o workflow **Publish and deploy
production** deve terminar com os jobs `publish image` e `deploy Render` verdes.

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
| Implantação da imagem publicada  | deploy hook Render com digest imutável                              |
| Migrations e seed                | `docker/start.sh` no boot do container                              |
| Banco gerenciado com TLS         | URL externa Render e `DB_SSL=true`                                  |
| Segredos fora do Git             | Render Environment, GitHub Actions Secrets e credencial de registry |

Os checks de qualidade e integração PostgreSQL 16 continuam no workflow de Pull
Request. O workflow de produção não substitui esses checks; a proteção de branch deve
exigir o job `validate` antes do merge.
