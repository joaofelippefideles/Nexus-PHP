<?php
/**
 * ==========================================================================
 * NEXUS TECH — Conexão com o banco de dados (PDO)
 * --------------------------------------------------------------------------
 * Padrão principal: MySQL (mesmo banco usado pelo backend Node do projeto).
 * Fallback opcional: SQLite local, para que o cadastro funcione mesmo em
 * máquinas sem MySQL instalado (ambiente acadêmico).
 *
 * Todas as consultas do projeto usam consultas preparadas (?), portanto
 * este arquivo apenas fornece a conexão — nunca concatena SQL com dados
 * vindos do usuário.
 * ==========================================================================
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/functions.php';

/**
 * Retorna uma conexão PDO única (memoizada).
 */
function nexus_db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = nexus_config();
    $driver = (string) $config['db']['driver'];

    if ($driver === 'sqlite') {
        $pdo = nexus_sqlite_connection($config);
        return $pdo;
    }

    try {
        $pdo = nexus_mysql_connection($config);
        return $pdo;
    } catch (PDOException $exception) {
        $fallback = (bool) $config['db']['allow_sqlite_fallback'];

        if (!$fallback) {
            nexus_log('Falha ao conectar ao MySQL: ' . $exception->getMessage());
            throw new RuntimeException(
                'Não foi possível conectar ao banco de dados. Verifique a configuração em includes/config.php.',
                0,
                $exception
            );
        }

        nexus_log('MySQL indisponível; usando SQLite local. Detalhe: ' . $exception->getMessage());
        $pdo = nexus_sqlite_connection($config);

        return $pdo;
    }
}

/**
 * Conexão MySQL via PDO com charset utf8mb4.
 *
 * @param array<string, mixed> $config
 */
function nexus_mysql_connection(array $config): PDO
{
    $db = $config['db'];

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $db['host'],
        (int) $db['port'],
        $db['name'],
        $db['charset']
    );

    return new PDO($dsn, (string) $db['user'], (string) $db['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_STRINGIFY_FETCHES => false,
    ]);
}

/**
 * Conexão SQLite local com criação automática do esquema.
 *
 * @param array<string, mixed> $config
 */
function nexus_sqlite_connection(array $config): PDO
{
    $path = (string) $config['db']['sqlite_path'];
    $dir = dirname($path);

    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }

    $pdo = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA journal_mode = WAL');

    $schemaFile = (string) $config['db']['sqlite_schema'];
    if (is_file($schemaFile)) {
        $schema = file_get_contents($schemaFile);
        if (is_string($schema) && trim($schema) !== '') {
            // PDO::exec não garante múltiplos statements; executamos um a um.
            foreach (preg_split('/;\s*(?:\r?\n|$)/', $schema) ?: [] as $statement) {
                $lines = array_filter(
                    preg_split('/\R/', $statement) ?: [],
                    static fn (string $line): bool => !str_starts_with(ltrim($line), '--')
                );
                $statement = trim(implode("\n", $lines));
                if ($statement !== '') {
                    $pdo->exec($statement);
                }
            }
        }
    }

    return $pdo;
}

/**
 * Verifica se uma exceção PDO representa violação de unicidade.
 */
function nexus_is_duplicate_error(PDOException $exception): bool
{
    $sqlState = (string) $exception->getCode();
    $driverCode = $exception->errorInfo[1] ?? null;
    $message = strtolower($exception->getMessage());

    return str_starts_with($sqlState, '23')
        || (int) $driverCode === 1062
        || str_contains($message, 'unique')
        || str_contains($message, 'duplicate');
}
