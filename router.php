<?php
/**
 * ==========================================================================
 * NEXUS TECH — Roteador para o servidor embutido do PHP
 * --------------------------------------------------------------------------
 * Uso:
 *   php -S localhost:8000 router.php
 *
 * O servidor embutido ignora o .htaccess. Este roteador bloqueia o acesso
 * web às pastas internas (includes, database, logs, server) e a arquivos
 * sensíveis (.env, .sql, .db, .log), mantendo o cadastro funcionando
 * normalmente. Em produção, prefira Apache/XAMPP com o .htaccess.
 * ==========================================================================
 */

declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path = is_string($path) ? rawurldecode($path) : '/';
$path = str_replace('\\', '/', $path);

$blockedPrefixes = ['/includes/', '/database/', '/logs/', '/server/', '/.git/'];
foreach ($blockedPrefixes as $prefix) {
    if (str_starts_with($path, $prefix)) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        echo '403 - Acesso negado';
        return true;
    }
}

if (preg_match('#(^|/)\.#', $path) === 1
    || preg_match('#\.(env|sql|sqlite|sqlite3|db|log|ini)$#i', $path) === 1) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo '403 - Acesso negado';
    return true;
}

// Deixa o servidor embutido entregar o arquivo/executar o PHP normalmente.
return false;
