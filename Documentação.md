# Documentação do HTML --- Nexus Tech

## 1. Introdução

Este documento apresenta a estrutura do arquivo HTML da página inicial
da **Nexus Tech**, uma loja virtual de produtos de tecnologia e
informática. O objetivo é explicar a função dos principais elementos,
atributos e seções utilizados no código.

O HTML (HyperText Markup Language) define a estrutura e o conteúdo da
página. Ele trabalha em conjunto com o CSS, responsável pela
apresentação visual, e com o JavaScript, responsável pelas interações e
funcionalidades.

## 2. Estrutura básica do documento

O documento começa com:

-   `<!DOCTYPE html>`: informa ao navegador que o arquivo utiliza HTML5.
-   `<html lang="pt-BR">`: elemento raiz do documento e definição do
    idioma como português brasileiro.
-   `<head>`: reúne metadados, título, configurações e referências a
    arquivos externos.
-   `<body>`: contém o conteúdo que será apresentado ao visitante.

## 3. Configurações do HEAD

Dentro de `<head>` estão as configurações da página:

-   `meta charset="UTF-8"`: permite a exibição correta de acentos e
    caracteres especiais.
-   `meta name="viewport"`: ajuda a adaptar a página à largura de
    dispositivos móveis.
-   `<title>`: define o título exibido na aba do navegador.
-   `meta name="description"`: fornece uma descrição da página para
    mecanismos de busca.
-   `meta name="keywords"`: registra palavras-chave relacionadas ao
    conteúdo.
-   Metadados `og:*`: definem informações usadas quando a página é
    compartilhada em redes sociais e aplicativos.
-   `link rel="icon"`: define o favicon, pequeno ícone da aba do
    navegador.
-   `link rel="stylesheet"`: conecta o documento ao arquivo CSS.

No projeto, o CSS principal está em `assets/css/style.css`.

## 4. BODY e identificação da página

O elemento `<body data-page="home">` contém o conteúdo visível da
página.

O atributo `data-page="home"` é personalizado e pode ser consultado pelo
JavaScript para identificar que o documento corresponde à página
inicial.

## 5. HEADER --- Cabeçalho

O `<header>` reúne os elementos principais de navegação e acesso do
usuário:

-   **Menu hambúrguer:** botão utilizado para abrir ou fechar a
    navegação em telas menores.
-   **Logo:** link que leva à página inicial.
-   **Menu principal:** links para Home, Produtos, Ofertas e Contato.
-   **Pesquisa:** formulário com campo de busca e botão.
-   **Favoritos:** botão e contador de itens favoritos.
-   **Carrinho:** botão e contador de itens adicionados.
-   **Minha conta:** link para a página de perfil.

Elementos HTML importantes nessa região:

-   `<nav>`: identifica uma área de navegação.
-   `<ul>` e `<li>`: organizam itens em uma lista.
-   `<a>`: cria links.
-   `<button>`: cria botões interativos.
-   `<form>`: agrupa campos e ações de formulário.
-   `<input>`: permite a entrada de dados.
-   `<svg>`: permite inserir ícones vetoriais.

Os atributos `aria-label`, `aria-expanded` e `aria-controls` ajudam a
tornar os controles mais compreensíveis para tecnologias assistivas.

## 6. MAIN --- Conteúdo principal

O `<main>` agrupa o conteúdo central da página inicial. No projeto, ele
contém seis áreas.

### 6.1 Hero --- Banner principal

A seção `hero` apresenta a marca, o título principal, uma descrição e o
botão "Ver produtos". O botão direciona o visitante para
`pages/produtos.html`.

O elemento `<h1>` representa o título principal da página. O conteúdo
visual complementar está na área `hero__media`.

### 6.2 Categorias

A seção `categories` apresenta atalhos para categorias como:

-   Notebooks;
-   Monitores;
-   Teclados;
-   Mouses;
-   Headsets;
-   Celulares;
-   Games;
-   Acessórios.

Cada categoria é um link organizado em uma lista. Na versão apresentada,
os links direcionam para a página geral de produtos; filtros específicos
por categoria podem ser implementados posteriormente.

### 6.3 Produtos em destaque

A seção `products-section` apresenta cartões de produtos. Cada cartão
utiliza `<article>` e contém:

-   Identificação do produto;
-   Etiqueta de promoção ou novidade;
-   Botão de favoritos;
-   Espaço reservado para imagem;
-   Marca e nome;
-   Avaliação;
-   Preço anterior, quando aplicável;
-   Preço atual;
-   Botão "Adicionar ao carrinho".

O atributo `data-product-id` associa um identificador ao cartão. Esse
valor pode ser lido pelo JavaScript para identificar qual produto
recebeu uma ação.

Os produtos exibidos no HTML são exemplos estáticos. Para carregar
produtos reais, será necessário integrar a página a uma fonte de dados,
como uma API ou backend.

### 6.4 Ofertas da semana

A seção `offers` destaca uma mensagem promocional e apresenta um link
para a página de produtos. O identificador `id="ofertas"` permite que
links internos, como `href="#ofertas"`, levem diretamente até essa área.

### 6.5 Mais vendidos

A seção `products-section--alt` apresenta outro conjunto de cartões,
destinado aos produtos mais vendidos.

O sufixo `--alt` segue um padrão de nomenclatura de classes que permite
aplicar uma variação visual pelo CSS. A classificação como "mais
vendido" deve ser sustentada por dados reais quando o sistema estiver
integrado.

### 6.6 Newsletter

A seção `newsletter` contém um formulário para o visitante informar seu
e-mail.

-   `type="email"` indica que o campo espera um endereço de e-mail.
-   `required` exige o preenchimento antes do envio.
-   `autocomplete="email"` permite que o navegador sugira um endereço
    salvo.
-   `newsletter-feedback` é uma área destinada a mensagens de retorno.

A validação básica do campo é feita pelo navegador. Para armazenar os
cadastros, enviar mensagens ou administrar inscrições, será necessária
uma integração com backend ou serviço apropriado.

## 7. FOOTER --- Rodapé

O `<footer>` reúne informações complementares e links institucionais:

1.  Identificação e slogan da Nexus Tech;
2.  Links da loja;
3.  Links de atendimento;
4.  Links institucionais;
5.  Redes sociais;
6.  Formas de pagamento;
7.  Aviso de direitos autorais.

Os links de redes sociais utilizam `href="#"` como placeholder. Eles
devem ser substituídos pelos endereços reais antes da publicação.

O elemento `footer-year` contém o ano exibido nos direitos autorais. O
JavaScript pode atualizá-lo automaticamente, desde que essa lógica
esteja implementada.

## 8. CSS --- Apresentação visual

O arquivo `assets/css/style.css` é carregado pelo elemento
`<link rel="stylesheet">`.

Ele é responsável por definir, entre outras coisas:

-   Cores e fundos;
-   Tipografia;
-   Larguras e alturas;
-   Margens e espaçamentos;
-   Bordas e sombras;
-   Organização dos cartões;
-   Posicionamento dos elementos;
-   Adaptação para celulares e tablets.

As classes, como `site-header`, `products-grid` e `product-card`,
permitem aplicar estilos a partes específicas da página.

## 9. JavaScript --- Interatividade

O HTML carrega dois arquivos JavaScript:

### `assets/js/modules/header.js`

É indicado para controlar as interações do cabeçalho, especialmente o
menu de navegação em dispositivos móveis.

### `assets/js/modules/home/home.js`

É indicado para controlar as interações específicas da página inicial,
como favoritos, carrinho e newsletter.

O atributo `type="module"` permite que o arquivo utilize módulos
JavaScript, incluindo `import` e `export`.

A presença dos arquivos no HTML não garante, por si só, que todas as
funcionalidades estejam concluídas. É necessário verificar o conteúdo
desses arquivos e testar cada interação no navegador.

## 10. Atributos HTML importantes

  -----------------------------------------------------------------------
  Atributo                            Função
  ----------------------------------- -----------------------------------
  `class`                             Associa uma classe usada
                                      principalmente pelo CSS e também
                                      pelo JavaScript.

  `id`                                Define um identificador único para
                                      localizar um elemento.

  `href`                              Define o destino de um link.

  `src`                               Define o caminho de um arquivo
                                      incorporado.

  `type`                              Especifica o tipo de controle ou
                                      recurso.

  `name`                              Identifica um campo enviado por um
                                      formulário.

  `placeholder`                       Exibe uma orientação dentro de um
                                      campo.

  `required`                          Exige o preenchimento de um campo.

  `aria-label`                        Fornece um nome acessível a um
                                      elemento.

  `aria-hidden`                       Oculta o elemento de tecnologias
                                      assistivas.

  `data-*`                            Armazena dados personalizados no
                                      elemento HTML.

  `autocomplete`                      Orienta o navegador sobre o
                                      preenchimento automático.
  -----------------------------------------------------------------------

## 11. Elementos semânticos

O projeto utiliza elementos semânticos do HTML5:

-   `<header>`: cabeçalho de uma página ou seção;
-   `<nav>`: conjunto de links de navegação;
-   `<main>`: conteúdo principal;
-   `<section>`: seção temática;
-   `<article>`: conteúdo independente, como um cartão de produto;
-   `<footer>`: rodapé.

O uso adequado desses elementos ajuda a organizar o documento, facilita
a manutenção e melhora a compreensão da estrutura por navegadores e
tecnologias assistivas.

## 12. Situação das funcionalidades

Com base apenas no HTML apresentado, é possível identificar a seguinte
situação:

  -----------------------------------------------------------------------
  Recurso                             Situação observada
  ----------------------------------- -----------------------------------
  Estrutura da página inicial         Presente no HTML

  Menu e links de navegação           Estrutura presente

  Categorias                          Estrutura presente

  Cartões de produtos                 Exemplos estáticos

  Favoritos                           Controles visuais presentes; lógica
                                      depende do JavaScript

  Carrinho                            Controles visuais presentes; lógica
                                      depende do JavaScript

  Pesquisa                            Formulário visual; busca funcional
                                      não demonstrada

  Newsletter                          Formulário presente; armazenamento
                                      não demonstrado

  Imagens dos produtos                Espaços reservados por placeholders

  Banco de dados                      Não demonstrado no HTML

  Pagamento                           Apenas identificadores visuais de
                                      formas de pagamento
  -----------------------------------------------------------------------

## 13. Melhorias e próximos passos

Para evoluir a Nexus Tech de uma página estática para uma loja virtual
funcional, recomenda-se:

1.  Conferir e aprimorar a responsividade do CSS;
2.  Substituir os placeholders por imagens adequadas dos produtos;
3.  Implementar a pesquisa e os filtros por categoria;
4.  Implementar favoritos e carrinho com persistência apropriada;
5.  Criar backend e API para produtos, usuários e pedidos;
6.  Integrar um banco de dados;
7.  Implementar autenticação e gerenciamento de contas;
8.  Integrar um provedor de pagamento adequado;
9.  Implementar validação e armazenamento seguro dos cadastros da
    newsletter;
10. Testar acessibilidade, navegação, segurança e funcionamento em
    diferentes dispositivos.

## 14. Conclusão

O HTML da Nexus Tech apresenta uma estrutura organizada para a página
inicial de um e-commerce. A separação em cabeçalho, conteúdo principal e
rodapé facilita a leitura e a manutenção do código. O uso de classes
permite conectar os elementos ao CSS, enquanto os identificadores e
atributos `data-*` podem auxiliar o JavaScript a localizar componentes e
executar ações.

O arquivo representa principalmente a estrutura da interface. Recursos
como pesquisa real, persistência do carrinho, autenticação, banco de
dados e pagamentos precisam ser implementados e integrados às demais
camadas do sistema.
