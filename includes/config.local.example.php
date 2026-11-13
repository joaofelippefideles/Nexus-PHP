<?php
/**
 * ==========================================================================
 * NEXUS TECH — Exemplo de configuração local do backend PHP
 * --------------------------------------------------------------------------
 * Copie este arquivo para `includes/config.local.php` apenas se precisar
 * sobrescrever algum valor padrão (por exemplo, a senha do MySQL).
 *
 * `config.local.php` está no .gitignore e NÃO deve ser enviado ao
 * repositório nem à entrega, pois contém credenciais.
 *
 * Você também pode usar variáveis de ambiente (DB_HOST, DB_PORT, DB_NAME,
 * DB_USER, DB_PASSWORD, DB_DRIVER, DB_ALLOW_SQLITE_FALLBACK) em vez deste
 * arquivo.
 * ==========================================================================
 */

return [
    'app' => [
        'env' => 'development',
    ],
    'db' => [
        // 'mysql' (padrão) ou 'sqlite'
        'driver' => 'mysql',
        'host' => '127.0.0.1',
        'port' => 3306,
        'name' => 'nexus_tech_db',
        'user' => 'root',
        'password' => '',
        // Em desenvolvimento, permite usar SQLite se o MySQL não responder.
        'allow_sqlite_fallback' => true,
    ],
];
