<?php
/**
 * ==========================================================================
 * NEXUS TECH — Funções compartilhadas do backend PHP
 * --------------------------------------------------------------------------
 * Sessão segura, CSRF, flash messages, respostas JSON, sanitização de saída,
 * limitação de tentativas e log de erros (sem dados sensíveis).
 * ==========================================================================
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Escapa qualquer valor para uso seguro em HTML (previne XSS).
 */
function e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * Inicia a sessão com cookies HttpOnly/SameSite e nome próprio.
 */
function nexus_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $config = nexus_config();
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');

    session_name((string) $config['security']['session_name']);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    session_start();
}

/**
 * Retorna (ou cria) o token CSRF da sessão atual.
 */
function nexus_csrf_token(): string
{
    nexus_start_session();
    $key = (string) nexus_config()['security']['csrf_key'];

    if (empty($_SESSION[$key]) || !is_string($_SESSION[$key])) {
        $_SESSION[$key] = bin2hex(random_bytes(32));
    }

    return $_SESSION[$key];
}

/**
 * Valida o token CSRF em tempo constante.
 */
function nexus_csrf_valid(?string $token): bool
{
    nexus_start_session();
    $key = (string) nexus_config()['security']['csrf_key'];

    return is_string($token)
        && $token !== ''
        && isset($_SESSION[$key])
        && is_string($_SESSION[$key])
        && hash_equals($_SESSION[$key], $token);
}

/**
 * Grava uma mensagem flash consumida na próxima requisição.
 */
function nexus_flash_set(string $key, mixed $value): void
{
    nexus_start_session();
    $_SESSION['_flash'][$key] = $value;
}

/**
 * Lê e remove uma mensagem flash.
 */
function nexus_flash_get(string $key, mixed $default = null): mixed
{
    nexus_start_session();

    if (!isset($_SESSION['_flash'][$key])) {
        return $default;
    }

    $value = $_SESSION['_flash'][$key];
    unset($_SESSION['_flash'][$key]);

    return $value;
}

/**
 * Detecta requisições AJAX/Fetch que esperam JSON.
 */
function nexus_is_json_request(): bool
{
    $accept = (string) ($_SERVER['HTTP_ACCEPT'] ?? '');
    $requestedWith = strtolower((string) ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? ''));
    $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));

    return str_contains(strtolower($accept), 'application/json')
        || $requestedWith === 'xmlhttprequest'
        || str_contains($contentType, 'application/json');
}

/**
 * Envia uma resposta JSON padronizada e encerra a requisição.
 *
 * @param array<string, mixed> $payload
 */
function nexus_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');

    echo json_encode(
        $payload,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

    exit;
}

/**
 * Redireciona de forma segura (apenas caminho local) e encerra.
 */
function nexus_redirect(string $path): never
{
    if (preg_match('#^(https?:)?//#i', $path) === 1) {
        $path = 'cadastro.php';
    }

    header('Location: ' . $path, true, 303);
    exit;
}

/**
 * Limita tentativas por chave dentro de uma janela de tempo (sessão).
 */
function nexus_rate_limit_exceeded(string $key, int $max, int $windowSeconds): bool
{
    nexus_start_session();

    $now = time();
    $bucket = $_SESSION['_rate'][$key] ?? [];
    if (!is_array($bucket)) {
        $bucket = [];
    }

    $bucket = array_values(array_filter(
        $bucket,
        static fn ($timestamp): bool => is_int($timestamp) && $timestamp > ($now - $windowSeconds)
    ));

    if (count($bucket) >= $max) {
        $_SESSION['_rate'][$key] = $bucket;
        return true;
    }

    $bucket[] = $now;
    $_SESSION['_rate'][$key] = $bucket;

    return false;
}

/**
 * Registra uma mensagem de erro no log local (sem senhas/dados sensíveis).
 */
function nexus_log(string $message): void
{
    $config = nexus_config();
    $dir = (string) $config['paths']['logs'];

    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }

    $line = sprintf(
        "[%s] %s%s",
        date('Y-m-d H:i:s'),
        str_replace(["\r", "\n"], ' ', $message),
        PHP_EOL
    );

    @file_put_contents($dir . DIRECTORY_SEPARATOR . 'nexus-php.log', $line, FILE_APPEND | LOCK_EX);
}

/**
 * Normaliza um valor textual recebido do formulário.
 */
function nexus_input_string(mixed $value): string
{
    return is_string($value) ? trim($value) : '';
}
