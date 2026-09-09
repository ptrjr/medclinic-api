# MedClinic API

API desenvolvida como mini-projeto avaliativo do módulo de Back-end com Node.js.

Nesta etapa, o projeto tem foco exclusivamente na base de autenticação e autorização da aplicação MedClinic.

## Tecnologias utilizadas

- Node.js
- TypeScript
- Express
- TypeORM
- PostgreSQL
- JWT
- bcrypt
- dotenv

## Funcionalidades implementadas

- Cadastro de usuários
- Validação de e-mail duplicado
- Hash de senha com bcrypt
- Login com JWT
- Middleware de autenticação
- Controle de acesso por perfil (RBAC)
- Perfil Administrador
- Perfil Atendente
- Endpoint do usuário autenticado
- Endpoint exclusivo para administrador
- Tratamento centralizado de erros

## Perfis de acesso

### Administrador

Possui acesso às rotas autenticadas e às rotas administrativas da aplicação.

### Atendente

Possui acesso às rotas autenticadas permitidas, mas não às rotas exclusivas de administrador.

## Estrutura do projeto

```text
src/
├── @types/
├── controllers/
├── database/
├── entities/
├── errors/
├── middlewares/
├── repositories/
├── routes/
├── services/
└── server.ts

database/
└── medclinic.sql
```

A aplicação utiliza uma arquitetura em camadas, separando responsabilidades entre rotas, controllers, services, repositories, entities e middlewares.

## Configuração do ambiente

Clone o repositório e instale as dependências:

```bash
npm install
```

Crie um arquivo `.env` na raiz do projeto utilizando `.env.example` como referência.

Exemplo:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=sua_senha
DB_DATABASE=medclinic

PORT=3000

JWT_SECRET=sua_chave_secreta
JWT_EXPIRES_IN=1d
```

## Banco de dados

O projeto utiliza PostgreSQL.

Crie um banco chamado:

```text
medclinic
```

O script para criação da estrutura inicial está disponível em:

```text
database/medclinic.sql
```

## Executando o projeto

Para executar em modo de desenvolvimento:

```bash
npm run dev
```

Por padrão, a API utiliza:

```text
http://localhost:3000
```

## Endpoints

### Cadastro

```http
POST /auth/register
```

Exemplo de requisição:

```json
{
  "name": "Usuario Teste",
  "email": "teste@email.com",
  "password": "123456",
  "role": "Atendente"
}
```

A senha é armazenada utilizando hash com bcrypt e nunca é retornada pela API.

### Login

```http
POST /auth/login
```

Exemplo de requisição:

```json
{
  "email": "teste@email.com",
  "password": "123456"
}
```

Em caso de sucesso, a API retorna um token JWT.

O token contém o identificador do usuário e seu perfil de acesso.

### Usuário autenticado

```http
GET /users/me
```

É necessário enviar o JWT no cabeçalho:

```text
Authorization: Bearer SEU_TOKEN
```

Retorna os dados do usuário autenticado sem expor sua senha.

### Área administrativa

```http
GET /admin/ping
```

Necessita autenticação e perfil:

```text
Administrador
```

Um usuário autenticado com perfil `Atendente` recebe:

```text
403 Forbidden
```

## Respostas de erro

A API utiliza códigos HTTP apropriados para diferentes situações:

- `400 Bad Request` - dados obrigatórios ausentes
- `401 Unauthorized` - credenciais ou token inválidos
- `403 Forbidden` - usuário sem permissão
- `409 Conflict` - e-mail já cadastrado
- `500 Internal Server Error` - erro interno inesperado

## Segurança

- Senhas não são armazenadas em texto puro
- bcrypt é utilizado para gerar o hash das senhas
- JWT é utilizado para autenticação
- Tokens possuem tempo de expiração
- O arquivo `.env` não é versionado
- Credenciais inválidas não revelam se o erro ocorreu no e-mail ou na senha

## Escopo desta entrega

Esta etapa contempla somente a estrutura de autenticação e autorização da MedClinic API.

Não fazem parte desta entrega:

- Especialidades
- Médicos
- Pacientes
- Consultas

Esses recursos pertencem às próximas etapas do projeto.

## Autor

Mauricio Petri Junior