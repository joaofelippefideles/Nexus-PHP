# NEXUS TECH

**Tecnologia que conecta você ao futuro.**

Projeto acadêmico de e-commerce de tecnologia e informática, desenvolvido para a
disciplina **Desenvolvimento Web em HTML5, CSS, JavaScript e PHP** (2026/2).

O projeto reúne uma loja virtual completa no front-end (catálogo, produto, carrinho,
checkout e perfil) e um **cadastro real processado por PHP**, com validação no
navegador e no servidor, persistência em banco de dados, proteção CSRF e senha
armazenada apenas como hash bcrypt.

---

## Sumário

- [Objetivo do sistema](#objetivo-do-sistema)
- [Funcionalidades](#funcionalidades)
- [Tecnologias utilizadas](#tecnologias-utilizadas)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Onde cada tecnologia é utilizada](#onde-cada-tecnologia-é-utilizada)
- [Como executar localmente](#como-executar-localmente)
- [Como configurar o banco de dados](#como-configurar-o-banco-de-dados)
- [Como testar a página de cadastro](#como-testar-a-página-de-cadastro)
- [Segurança implementada](#segurança-implementada)
- [Atendimento aos requisitos da disciplina](#atendimento-aos-requisitos-da-disciplina)
- [Testes realizados](#testes-realizados)
- [Pendências e observações](#pendências-e-observações)

---

## Objetivo do sistema

Oferecer uma experiência de loja virtual moderna e responsiva para produtos de
tecnologia, colocando em prática, de forma integrada, as quatro tecnologias da
disciplina:

- **HTML5** para a estrutura semântica de todas as páginas;
- **CSS3** para o design system, o layout responsivo e os estados visuais;
- **JavaScript** para validações, máscaras, interações e integração assíncrona;
- **PHP** para processar o cadastro, validar os dados no servidor e persistir as
  informações com segurança.

O foco acadêmico é demonstrar que as tecnologias **funcionam juntas em um sistema
real**, e não apenas como arquivos isolados.

---

## Funcionalidades

### Loja (front-end)

- Home com banner, categorias, produtos em destaque, ofertas e mais vendidos.
- Catálogo com busca, filtros por categoria/preço/ordenação e paginação.
- Página de produto com galeria, especificações e avaliações.
- Carrinho de compras com quantidades, remoção e subtotal (LocalStorage).
- Checkout com endereço, entrega, pagamento e resumo do pedido.
- Perfil do usuário com dados pessoais, endereços, favoritos e pedidos.
- Páginas institucionais: contato, ajuda, FAQ, sobre, privacidade e termos.
- Layout responsivo (desktop, tablet e celular), navegação por teclado e
  mensagens acessíveis (`aria-live`).

### Cadastro (PHP + banco de dados)

- Formulário com nome, e-mail, telefone, CPF, senha, confirmação de senha e
  aceite dos termos/privacidade.
- Validação no navegador antes do envio.
- Máscaras automáticas de telefone e CPF.
- Medidor de força de senha e botões para mostrar/ocultar senha.
- Verificação assíncrona de e-mail já cadastrado (Fetch API).
- Validação no servidor com as mesmas regras do navegador.
- Verificação dos dígitos do CPF e do DDD do telefone.
- Gravação em banco com consulta preparada e transação.
- Senha armazenada somente como hash bcrypt.
- Verificação de duplicidade de e-mail e CPF.
- Mensagens de sucesso e de erro acessíveis, sem recarregar a página quando o
  JavaScript está ativo e com fallback completo quando está desativado.

---

## Tecnologias utilizadas

| Tecnologia | Uso no projeto |
|---|---|
| HTML5 | Estrutura semântica, formulários, acessibilidade e SEO |
| CSS3 | Design system (tokens), componentes, layout responsivo e animações |
| JavaScript (ES6+) | Validação, máscaras, carrinho, filtros, Fetch API e DOM |
| PHP 8+ | Processamento do cadastro, validação no servidor e sessão |
| PDO | Conexão segura com MySQL e consultas preparadas |
| MySQL / MariaDB | Banco principal do cadastro (`database/script.sql`) |
| SQLite | Fallback local automático para desenvolvimento sem MySQL |
| LocalStorage | Carrinho, favoritos e preferências do front-end |
| Node.js (opcional) | Backend legado em `server/`, não necessário para o cadastro PHP |

O front-end não utiliza frameworks nem bibliotecas externas.

---

## Estrutura de pastas

```text
NEXUS TECH/
├── index.html                     → Home da loja
├── README.md                      → Documentação acadêmica
├── .htaccess                      → Segurança no Apache
├── router.php                     → Roteador seguro do servidor embutido do PHP
│
├── pages/                         → Páginas internas
│   ├── cadastro.php               → Cadastro real (HTML5 + CSS + JS + PHP)
│   ├── cadastro.html              → Redireciona para cadastro.php (compatibilidade)
│   ├── login.html                 → Login demonstrativo do front-end
│   ├── produtos.html              → Catálogo
│   ├── produto.html               → Detalhe do produto
│   ├── carrinho.html              → Carrinho
│   ├── checkout.html              → Checkout
│   ├── perfil.html                → Perfil do usuário
│   ├── contato.html               → Contato
│   ├── ajuda.html / faq.html      → Atendimento
│   ├── sobre.html                 → Institucional
│   ├── privacidade.html           → Política de privacidade
│   ├── termos.html                → Termos de uso
│   └── admin/                     → Painel administrativo (front-end)
│
├── includes/                      → Back-end PHP compartilhado
│   ├── config.php                 → Configuração central (ambiente)
│   ├── config.local.example.php   → Exemplo de configuração local
│   ├── conexao.php                → Conexão PDO (MySQL + fallback SQLite)
│   ├── functions.php              → Sessão, CSRF, flash, JSON, log, rate limit
│   ├── validacao.php              → Regras de validação do cadastro
│   ├── header.php                 → Cabeçalho compartilhado
│   ├── footer.php                 → Rodapé compartilhado
│   └── .htaccess                  → Bloqueia acesso web direto
│
├── database/                      → Banco de dados
│   ├── script.sql                 → Script MySQL/MariaDB do cadastro
│   ├── schema.sqlite.sql          → Esquema SQLite de fallback
│   ├── nexus_tech.db              → Banco SQLite local (criado automaticamente)
│   └── .htaccess                  → Bloqueia download do banco
│
├── assets/
│   ├── css/                       → Design system modular
│   │   ├── style.css              → Cascata de entrada (importa os módulos)
│   │   ├── tokens.css             → Cores, fontes, espaçamentos e sombras
│   │   ├── base.css               → Reset e estilos globais
│   │   ├── components.css         → Botões, alertas, badges, inputs
│   │   ├── header.css / footer.css
│   │   ├── home.css / catalog.css / product.css
│   │   ├── cart.css / checkout.css
│   │   ├── profile.css / auth.css / institutional.css
│   │   └── admin.css
│   ├── js/
│   │   ├── data/products.js       → Camada de dados do catálogo
│   │   ├── modules/
│   │   │   ├── auth/register-php.js → Cadastro: validação, máscaras e Fetch
│   │   │   ├── auth/auth.js / login.js
│   │   │   ├── cart/ / catalog/ / checkout/ / home/ / product/
│   │   │   ├── profile/ / institutional/ / admin/
│   │   │   └── header.js
│   │   └── utils/
│   │       ├── validators.js      → Validadores compartilhados
│   │       ├── api.js / user-api.js / config.js / format.js
│   └── img/                       → Logo, banners e imagens de produtos
│
├── server/                        → Backend Node legado (opcional)
├── logs/                          → Logs locais do PHP (não versionados)
└── Docs/                          → Documentos de apoio
```

---

## Onde cada tecnologia é utilizada

### HTML5

- `index.html` e todas as páginas em `pages/` usam `<!DOCTYPE html>`, `lang="pt-BR"`,
  `meta charset` e `meta viewport`.
- Elementos semânticos: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`,
  `<aside>`, `<footer>` e níveis de título coerentes.
- Formulários com `<form>`, `<fieldset>`, `<legend>`, `<label>` associado por
  `for`, `required`, `autocomplete`, `inputmode` e `aria-describedby`.
- SEO e compartilhamento com `<title>`, `meta description` e Open Graph.
- O cabeçalho e o rodapé do cadastro são gerados por `includes/header.php` e
  `includes/footer.php`, mantendo a mesma estrutura HTML5 das páginas estáticas.
- `pages/cadastro.php` é a página HTML5 cujo formulário é processado pelo PHP.

### CSS

- `assets/css/style.css` é o ponto único de entrada e importa todos os módulos
  na ordem correta.
- `tokens.css` centraliza cores, tipografia, espaçamentos, raios e sombras,
  evitando repetição de valores.
- `components.css`, `header.css`, `footer.css`, `auth.css` etc. estilizam
  componentes e páginas específicas.
- Estados visuais de botões, links, campos e menu: `:hover`, `:focus-visible`,
  `:disabled`, `.has-error`, `[aria-invalid="true"]`.
- Responsividade com `clamp()`, grids flexíveis e media queries; o layout foi
  verificado em desktop (1280 px), tablet (768 px) e celular (375 px).
- O cadastro usa `auth.css` e `institutional.css` (formulário, feedback,
  medidor de senha, botão mostrar/ocultar, honeypot e painel de sucesso).

### JavaScript

- `assets/js/modules/auth/register-php.js`:
  - valida nome, e-mail, telefone, CPF, senha, confirmação e consentimentos;
  - aplica máscaras de telefone e CPF em tempo real;
  - calcula a força da senha;
  - alterna mostrar/ocultar senha;
  - consulta disponibilidade do e-mail com **Fetch API** (`GET ?check_email=`);
  - envia o formulário com **Fetch API** e trata erros retornados pelo PHP;
  - confirma a operação com `window.confirm` antes de criar a conta;
  - exibe mensagens de sucesso/erro com `aria-live`;
  - mantém fallback para o envio tradicional caso o JavaScript esteja desativado.
- `assets/js/utils/validators.js` concentra validadores e formatadores usados
  pelo cadastro, espelhando as regras do PHP.
- `assets/js/modules/header.js` controla o menu mobile e o cabeçalho.
- Os demais módulos implementam carrinho, busca, filtros, produto, checkout,
  perfil e painel administrativo, demonstrando manipulação de DOM, eventos e
  LocalStorage.

### PHP

- `pages/cadastro.php`:
  - recebe `GET` (verificação de e-mail e retorno do cadastro) e `POST`;
  - valida CSRF, honeypot e limite de tentativas;
  - valida todos os campos no servidor;
  - grava o usuário e o perfil em uma transação;
  - trata e-mail/CPF duplicados;
  - responde em **JSON** (Fetch) ou redireciona com **PRG** (formulário tradicional).
- `includes/validacao.php`: regras de nome, e-mail, telefone, CPF, senha e
  consentimentos, com normalização dos dados.
- `includes/conexao.php`: conexão PDO memoizada, MySQL como padrão e SQLite como
  fallback automático; todas as consultas usam `prepare()`/`execute()`.
- `includes/functions.php`: sessão segura, token CSRF, mensagens flash, respostas
  JSON, redirecionamento seguro, limite de tentativas e log sem dados sensíveis.
- `includes/config.php`: configuração por variáveis de ambiente ou
  `config.local.php`, sem credenciais versionadas.
- `includes/header.php` e `includes/footer.php`: layout compartilhado das páginas
  PHP.

---

## Como executar localmente

### Requisitos

- PHP 8.1 ou superior com as extensões **PDO**, **mbstring** e **pdo_mysql**
  (recomendado) ou **pdo_sqlite** (fallback).
- MySQL/MariaDB (opcional se for usar o SQLite).
- Navegador moderno.
- XAMPP, Laragon, WAMP ou o servidor embutido do PHP.

### Opção 1 — XAMPP (recomendada para entrega)

1. Copie a pasta do projeto para `C:\xampp\htdocs\NEXUS TECH`.
2. Inicie **Apache** e **MySQL** no painel do XAMPP.
3. Importe o banco:
   - abra `http://localhost/phpmyadmin`;
   - aba **Importar**;
   - selecione `database/script.sql`;
   - clique em **Executar**.
4. Acesse:
   - `http://localhost/NEXUS%20TECH/index.html`
   - `http://localhost/NEXUS%20TECH/pages/cadastro.php`

> Se o MySQL não estiver disponível, o PHP usa automaticamente o SQLite em
> `database/nexus_tech.db` e cria as tabelas na primeira execução.

### Opção 2 — servidor embutido do PHP

Na raiz do projeto:

```bash
php -S localhost:8000 router.php
```

Acesse `http://localhost:8000/index.html` e
`http://localhost:8000/pages/cadastro.php`.

> O `router.php` bloqueia o acesso web a `includes/`, `database/`, `logs/`,
> `server/`, `.env` e arquivos de banco/log. No Windows, se o comando `php` não
> estiver no PATH, use o caminho completo (por exemplo,
> `C:\php\php.exe -S localhost:8000 router.php`). Para a entrega, prefira o
> Apache/XAMPP.

### Opção 3 — servidor estático (somente front-end)

O front-end também funciona com qualquer servidor estático, mas **o cadastro
exige PHP**. O script `dev-server.js` (Node) serve o front-end e faz proxy de
`/api/*` para o backend Node legado:

```bash
node dev-server.js
```

---

## Como configurar o banco de dados

### MySQL/MariaDB (padrão)

1. Importe `database/script.sql` no phpMyAdmin ou execute:

   ```bash
   mysql -u root -p < database/script.sql
   ```

2. O script cria o banco `nexus_tech_db` e as tabelas:
   - `users` — nome, e-mail único, hash da senha, perfil de acesso;
   - `user_profile` — telefone e CPF único, com chave estrangeira para `users`.

3. Os valores padrão estão em `includes/config.php`:

   | Configuração | Padrão |
   |---|---|
   | Host | `127.0.0.1` |
   | Porta | `3306` |
   | Banco | `nexus_tech_db` |
   | Usuário | `root` |
   | Senha | vazia |

4. Para alterar sem editar o código, use variáveis de ambiente:

   ```bash
   set DB_HOST=127.0.0.1
   set DB_USER=root
   set DB_PASSWORD=sua_senha
   set DB_NAME=nexus_tech_db
   ```

   Ou copie `includes/config.local.example.php` para
   `includes/config.local.php` e ajuste os valores. Esse arquivo é ignorado
   pelo Git e não deve ser entregue.

### SQLite (fallback automático)

- Se o MySQL estiver indisponível e `allow_sqlite_fallback` estiver ativo, o
  sistema usa `database/nexus_tech.db`.
- O esquema é criado automaticamente a partir de `database/schema.sqlite.sql`.
- Para forçar o SQLite:

  ```bash
  set DB_DRIVER=sqlite
  ```

- Para desativar o fallback:

  ```bash
  set DB_ALLOW_SQLITE_FALLBACK=0
  ```

> O banco existente é preservado. Não há comandos destrutivos no fluxo normal.

---

## Como testar a página de cadastro

1. Suba o projeto (XAMPP ou `php -S localhost:8000`).
2. Abra `pages/cadastro.php`.
3. **Teste de validação no navegador:** clique em **Criar conta** com o formulário
   vazio. Os campos são destacados e as mensagens aparecem sem enviar ao servidor.
4. **Teste de máscara:** digite o telefone `11987654321` e o CPF `12345678909`;
   os campos devem ser formatados como `(11) 98765-4321` e `123.456.789-09`.
5. **Teste de senha:** digite menos de 8 caracteres ou apenas letras; o medidor e
   as mensagens indicam o problema. Confirme uma senha diferente para ver o erro
   de confirmação.
6. **Teste de e-mail duplicado:** use um e-mail já cadastrado e saia do campo; o
   JavaScript consulta o PHP via Fetch e exibe “Este e-mail já está cadastrado.”.
7. **Teste de sucesso:** preencha dados válidos, aceite os dois termos e confirme
   a janela de confirmação. O painel “Conta criada com sucesso!” é exibido.
8. **Confira o banco:**
   - MySQL: `SELECT * FROM users;` e `SELECT * FROM user_profile;`
   - SQLite: abra `database/nexus_tech.db` ou use o phpLiteAdmin.
   - A senha deve aparecer como hash (`$2y$...`), nunca em texto puro.
9. **Teste sem JavaScript:** desative o JavaScript no navegador e envie o
   formulário. O PHP processa, redireciona (PRG) e exibe a mensagem de sucesso.
10. **Teste de duplicidade:** cadastre novamente o mesmo e-mail ou CPF; o servidor
    retorna erro amigável e não grava duplicatas.
11. **Teste de CPF inválido:** use `111.111.111-11`; o servidor deve recusar.
12. **Teste de CSRF:** recarregue a página e envie um formulário com token antigo;
    o servidor responde com erro de sessão expirada.

---

## Segurança implementada

- **SQL Injection:** todas as consultas usam PDO com consultas preparadas
  (`prepare` + `execute`); nunca há concatenação de dados do usuário no SQL.
- **XSS:** toda saída HTML passa por `e()` (`htmlspecialchars` com `ENT_QUOTES`).
- **Senhas:** `password_hash()` com bcrypt (custo 12); nunca são exibidas, logadas
  ou devolvidas ao navegador.
- **CSRF:** token por sessão, comparado com `hash_equals()`.
- **Sessão:** cookie `HttpOnly`, `SameSite=Lax` e `Secure` quando HTTPS.
- **Força bruta:** limite de tentativas por sessão em janela de tempo.
- **Robôs:** campo honeypot invisível.
- **Duplicidade:** índices únicos no banco para e-mail e CPF.
- **Logs:** sem senhas e sem dados pessoais em caso de duplicidade.
- **Apache:** `.htaccess` bloqueia acesso web a `includes/`, `database/`,
  `server/` e `logs/`, além de arquivos `.env`, `.sql`, `.db` e `.log`.
- **Credenciais:** `includes/config.local.php` e `server/.env` são ignorados pelo
  Git e não devem ser entregues.

---

## Atendimento aos requisitos da disciplina

| Exigência da professora | Como foi atendida | Arquivos principais |
|---|---|---|
| Páginas HTML5 | Estrutura semântica, `DOCTYPE`, `lang`, `meta viewport`, `header/nav/main/section/footer`, formulários acessíveis | `index.html`, `pages/*.html`, `pages/cadastro.php`, `includes/header.php`, `includes/footer.php` |
| Página de cadastro funcional | Formulário completo processado por PHP, com banco, validação e mensagens | `pages/cadastro.php`, `includes/validacao.php`, `includes/conexao.php` |
| Arquivos CSS | Design system modular, identidade visual preservada, responsividade e estados visuais | `assets/css/style.css` e demais arquivos de `assets/css/` |
| Arquivos JavaScript | Validação, máscaras, senha, e-mail via Fetch, DOM e confirmação | `assets/js/modules/auth/register-php.js`, `assets/js/utils/validators.js`, `assets/js/modules/header.js` |
| Arquivos PHP | Cadastro real, validação no servidor, PDO, sessão, CSRF e mensagens | `pages/cadastro.php`, `includes/*.php` |
| Estrutura semântica e organizada | Cabeçalho, menu e rodapé padronizados; HTML comentado para fins didáticos | `includes/header.php`, `includes/footer.php`, `index.html` |
| Formulários estruturados e validados | `fieldset`, `legend`, `label`, `required`, `autocomplete` e validação nas duas camadas | `pages/cadastro.php`, `includes/validacao.php` |
| Navegação funcional | Menu, breadcrumb, rodapé e redirecionamentos verificados | `includes/header.php`, `includes/footer.php`, `pages/cadastro.html` |
| Responsividade | Layout fluido e media queries para desktop, tablet e celular | `assets/css/*.css` |
| Identidade visual preservada | Tokens e componentes originais mantidos; cadastro integrado ao design existente | `assets/css/tokens.css`, `assets/css/auth.css` |
| Padronização de cores, fontes, botões e espaços | Variáveis CSS centralizadas e componentes reutilizáveis | `assets/css/tokens.css`, `assets/css/components.css` |
| Estados visuais | `:hover`, `:focus-visible`, `:disabled`, `.has-error`, `[aria-invalid]` | `assets/css/*.css` |
| Validação de formulários no navegador | Regras em JavaScript, mensagens por campo e foco no primeiro erro | `assets/js/modules/auth/register-php.js`, `assets/js/utils/validators.js` |
| Verificação de campos obrigatórios | Validação no navegador e no PHP | `register-php.js`, `includes/validacao.php` |
| Validação de e-mail | Formato no JS e `FILTER_VALIDATE_EMAIL` no PHP | `validators.js`, `includes/validacao.php` |
| Senha e confirmação de senha | Regras de tamanho/composição, confirmação e medidor de força | `register-php.js`, `includes/validacao.php` |
| Máscaras de campos | Telefone e CPF formatados em tempo real | `assets/js/utils/validators.js` |
| Mensagens de sucesso e erro | Feedback acessível com `aria-live` e mensagens flash | `pages/cadastro.php`, `register-php.js` |
| Interações com menus, botões e componentes | Menu mobile, favoritos, carrinho, filtros, acordeões e abas | `assets/js/modules/*` |
| Confirmação antes de operação importante | `window.confirm` antes de criar a conta | `register-php.js` |
| Manipulação do DOM | Renderização de produtos, carrinho, mensagens e estados | `assets/js/modules/*` |
| Integração com PHP via Fetch/AJAX | Verificação de e-mail (`GET`) e envio do cadastro (`POST` JSON) | `register-php.js`, `pages/cadastro.php` |
| Recebimento e validação no servidor | `$_POST`, validação, normalização e tratamento de erros | `pages/cadastro.php`, `includes/validacao.php` |
| Campos obrigatórios e dados inválidos no servidor | Erros por campo com status HTTP adequado (422/409/419/429/500) | `pages/cadastro.php` |
| Conexão com banco e cadastro dos dados | PDO + transação inserindo em `users` e `user_profile` | `includes/conexao.php`, `pages/cadastro.php` |
| Verificação de duplicidade | Índices únicos e tratamento de exceção para e-mail/CPF | `database/script.sql`, `pages/cadastro.php` |
| Proteção contra SQL Injection | Consultas preparadas em todas as operações | `pages/cadastro.php`, `includes/conexao.php` |
| Tratamento seguro dos dados | Sanitização de entrada, escape de saída, CSRF e bcrypt | `includes/functions.php`, `includes/validacao.php` |
| Preservação do banco existente | Nenhum comando destrutivo; esquema usa `CREATE IF NOT EXISTS` | `database/script.sql`, `database/schema.sqlite.sql` |
| README/documentação | Este arquivo, com objetivo, tecnologias, estrutura e testes | `README.md` |

---

## Testes realizados

- Verificação de links internos, `src` de scripts e imports de módulos ES6.
- Verificação de `DOCTYPE`, `lang`, `viewport` e `<main>` nas páginas.
- Testes HTTP com o servidor embutido do PHP:
  - abertura da página de cadastro e geração de token CSRF;
  - cadastro válido via JSON (HTTP 201);
  - e-mail duplicado (HTTP 409);
  - CPF inválido (HTTP 422);
  - campos obrigatórios vazios (HTTP 422);
  - token CSRF inválido (HTTP 419);
  - verificação assíncrona de e-mail;
  - envio sem JavaScript com redirecionamento PRG (HTTP 303);
  - renderização do painel de sucesso;
  - abertura das páginas estáticas principais.
- Teste de navegador (Chrome headless) com preenchimento do formulário,
  confirmação, mensagens de erro e verificação de ausência de erros no console.
- Verificação de responsividade em 1280 px, 768 px e 375 px.

---

## Pendências e observações

- O **login** em `pages/login.html` permanece demonstrativo, integrado ao
  front-end (LocalStorage/API opcional). O requisito da disciplina é o cadastro
  real, que está implementado em PHP. A criação de um login PHP completo pode ser
  feita como evolução futura, reutilizando `includes/conexao.php` e
  `password_verify()`.
- O painel administrativo e o carrinho continuam sendo front-end/JavaScript, com
  suporte opcional ao backend Node legado em `server/`. Esse backend **não é
  necessário** para executar o cadastro PHP.
- Em produção, recomenda-se servir o projeto por HTTPS para que o cookie de
  sessão use `Secure`, e remover/limitar o fallback SQLite.
- A pasta `server/node_modules` não deve ser incluída na entrega; apenas o código
  em `server/src`, `server/sql` e `server/package.json` é relevante.

---

## Licença

Projeto acadêmico — uso livre para fins educacionais.
