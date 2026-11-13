<?php
/**
 * ==========================================================================
 * NEXUS TECH — Configuração central do backend PHP
 * --------------------------------------------------------------------------
 * Valores lidos de variáveis de ambiente (com defaults seguros para
 * desenvolvimento local). Um arquivo opcional `config.local.php` pode
 * sobrescrever qualquer chave sem versionar credenciais.
 *
 * NUNCA versione senhas reais. O arquivo `config.local.php` está no
 * .gitignore.
 * ==========================================================================
 */

declare(strict_types=1);

/**
 * Mescla recursivamente dois arrays (override vence).
 *
 * @param array<string, mixed> $base
 * @param array<string, mixed> $override
 * @return array<string, mixed>
 */
function nexus_array_merge(array $base, array $override): array
{
    foreach ($override as $key => $value) {
        if (
            is_array($value) &&
            isset($base[$key]) &&
            is_array($base[$key])
        ) {
            $base[$key] = nexus_array_merge($base[$key], $value);
        } else {
            $base[$key] = $value;
        }
    }

    return $base;
}

/**
 * Retorna a configuração da aplicação (memoizada por requisição).
 *
 * @return array<string, mixed>
 */
function nexus_config(): array
{
    static $config = null;

    if ($config !== null) {
        return $config;
    }

    $password = getenv('DB_PASSWORD');

    $config = [
        'app' => [
            'name' => 'Nexus Tech',
            'env' => getenv('APP_ENV') ?: 'development',
        ],
        'db' => [
            // mysql (padrão do projeto) | sqlite
            'driver' => strtolower((string) (getenv('DB_DRIVER') ?: 'mysql')),
            'host' => getenv('DB_HOST') ?: '127.0.0.1',
            'port' => (int) (getenv('DB_PORT') ?: 3306),
            'name' => getenv('DB_NAME') ?: 'nexus_tech_db',
            'user' => getenv('DB_USER') ?: 'root',
            'password' => $password === false ? '' : $password,
            'charset' => 'utf8mb4',
            'sqlite_path' => dirname(__DIR__) . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'nexus_tech.db',
            'sqlite_schema' => dirname(__DIR__) . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'schema.sqlite.sql',
            // Em desenvolvimento, permite rodar sem MySQL instalado usando
            // SQLite. Defina DB_ALLOW_SQLITE_FALLBACK=0 para desativar.
            'allow_sqlite_fallback' => (getenv('DB_ALLOW_SQLITE_FALLBACK') ?: '1') !== '0',
        ],
        'security' => [
            'session_name' => 'nexus_php_session',
            'csrf_key' => '_csrf',
            'register_max_attempts' => 12,
            'register_window_seconds' => 600,
            'password_min_length' => 8,
            'password_max_length' => 72,
            'bcrypt_cost' => 12,
        ],
        'paths' => [
            'logs' => dirname(__DIR__) . DIRECTORY_SEPARATOR . 'logs',
        ],
    ];

    $localFile = __DIR__ . DIRECTORY_SEPARATOR . 'config.local.php';
    if (is_file($localFile)) {
        $local = require $localFile;
        if (is_array($local)) {
            $config = nexus_array_merge($config, $local);
        }
    }

    return $config;
}
