<?php
/**
 * ==========================================================================
 * NEXUS TECH — Rodapé compartilhado (PHP)
 * --------------------------------------------------------------------------
 * Espera $root definido pelo cabeçalho (ex.: "../" em pages/).
 * ==========================================================================
 */

declare(strict_types=1);

$root = isset($root) && is_string($root) ? $root : '../';
$pages = $root . 'pages/';
$home = $root . 'index.html';
?>
  <footer class="site-footer" role="contentinfo">
    <div class="container">

      <div class="site-footer__grid">

        <div class="site-footer__brand-col">
          <p class="site-footer__brand">NEXUS<span class="site-footer__brand-accent">TECH</span></p>
          <p class="site-footer__tagline">Tecnologia que conecta você ao futuro.</p>
        </div>

        <nav aria-label="Loja">
          <p class="site-footer__heading">Loja</p>
          <ul class="site-footer__list">
            <li><a href="<?= e($pages) ?>produtos.html" class="site-footer__link">Produtos</a></li>
            <li><a href="<?= e($home) ?>#ofertas" class="site-footer__link">Ofertas</a></li>
            <li><a href="<?= e($home) ?>#bestsellers-title" class="site-footer__link">Mais vendidos</a></li>
          </ul>
        </nav>

        <nav aria-label="Atendimento">
          <p class="site-footer__heading">Atendimento</p>
          <ul class="site-footer__list">
            <li><a href="<?= e($pages) ?>ajuda.html" class="site-footer__link">Central de ajuda</a></li>
            <li><a href="<?= e($pages) ?>contato.html" class="site-footer__link">Contato</a></li>
            <li><a href="<?= e($pages) ?>faq.html" class="site-footer__link">FAQ</a></li>
          </ul>
        </nav>

        <nav aria-label="Institucional">
          <p class="site-footer__heading">Institucional</p>
          <ul class="site-footer__list">
            <li><a href="<?= e($pages) ?>sobre.html" class="site-footer__link">Sobre nós</a></li>
            <li><a href="<?= e($pages) ?>privacidade.html" class="site-footer__link">Privacidade</a></li>
            <li><a href="<?= e($pages) ?>termos.html" class="site-footer__link">Termos</a></li>
          </ul>
        </nav>

        <div>
          <p class="site-footer__heading">Redes sociais</p>
          <div class="site-footer__social">
            <a href="#" class="site-footer__social-btn" aria-label="Instagram">IG</a>
            <a href="#" class="site-footer__social-btn" aria-label="Facebook">FB</a>
            <a href="#" class="site-footer__social-btn" aria-label="YouTube">YT</a>
          </div>
        </div>

      </div>

      <div class="site-footer__bottom">
        <div class="site-footer__payments" aria-label="Formas de pagamento aceitas">
          <span class="pay-badge">VISA</span>
          <span class="pay-badge">MASTERCARD</span>
          <span class="pay-badge">PIX</span>
          <span class="pay-badge">BOLETO</span>
        </div>
        <p class="site-footer__copy">© <span id="footer-year">2026</span> Nexus Tech. Todos os direitos reservados.</p>
      </div>

    </div>
  </footer>
