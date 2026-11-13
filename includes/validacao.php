<?php
/**
 * ==========================================================================
 * NEXUS TECH — Validação e normalização de dados do cadastro
 * --------------------------------------------------------------------------
 * Regras espelham o backend Node (server/src/validation) e o JavaScript
 * do storefront, para que a mesma conta seja válida nas duas camadas:
 *   - nome: 2 a 120 caracteres;
 *   - e-mail: formato válido, até 190 caracteres, sempre minúsculo;
 *   - telefone: DDD + 8/9 dígitos, salvo como "(DD) XXXXX-XXXX";
 *   - CPF: dígitos verificadores, salvo como "000.000.000-00";
 *   - senha: 8 a 72 caracteres, com letras e números;
 *   - confirmação de senha e aceite dos termos/privacidade obrigatórios.
 *
 * Nenhuma senha é logada ou devolvida ao navegador.
 * ==========================================================================
 */

declare(strict_types=1);

/**
 * Remove tudo que não for dígito.
 */
function nexus_only_digits(mixed $value): string
{
    return preg_replace('/\D+/', '', (string) $value) ?? '';
}

/**
 * Valida os dígitos verificadores do CPF.
 */
function nexus_is_valid_cpf_digits(string $digits): bool
{
    if (preg_match('/^\d{11}$/', $digits) !== 1) {
        return false;
    }

    if (preg_match('/^(\d)\1{10}$/', $digits) === 1) {
        return false;
    }

    $sum = 0;
    for ($i = 0; $i < 9; $i++) {
        $sum += (int) $digits[$i] * (10 - $i);
    }
    $first = 11 - ($sum % 11);
    if ($first >= 10) {
        $first = 0;
    }
    if ($first !== (int) $digits[9]) {
        return false;
    }

    $sum = 0;
    for ($i = 0; $i < 10; $i++) {
        $sum += (int) $digits[$i] * (11 - $i);
    }
    $second = 11 - ($sum % 11);
    if ($second >= 10) {
        $second = 0;
    }

    return $second === (int) $digits[10];
}

/**
 * Formata 11 dígitos como CPF.
 */
function nexus_format_cpf(string $digits): string
{
    return substr($digits, 0, 3) . '.'
        . substr($digits, 3, 3) . '.'
        . substr($digits, 6, 3) . '-'
        . substr($digits, 9, 2);
}

/**
 * Valida DDD + número (10 ou 11 dígitos, DDD entre 11 e 99).
 */
function nexus_is_valid_phone_digits(string $digits): bool
{
    if (preg_match('/^\d{10,11}$/', $digits) !== 1) {
        return false;
    }

    $ddd = substr($digits, 0, 2);

    return $ddd[0] !== '0' && $ddd[1] !== '0';
}

/**
 * Formata telefone como "(DD) XXXXX-XXXX" ou "(DD) XXXX-XXXX".
 */
function nexus_format_phone(string $digits): string
{
    if (strlen($digits) === 11) {
        return '(' . substr($digits, 0, 2) . ') '
            . substr($digits, 2, 5) . '-'
            . substr($digits, 7, 4);
    }

    return '(' . substr($digits, 0, 2) . ') '
        . substr($digits, 2, 4) . '-'
        . substr($digits, 6, 4);
}

/**
 * Valida e normaliza os dados do cadastro.
 *
 * @param array<string, mixed> $input Normalmente $_POST.
 * @return array{
 *     ok: bool,
 *     data: array<string, mixed>,
 *     errors: array<string, string>
 * }
 */
function nexus_validate_registration(array $input): array
{
    $config = nexus_config();
    $minPassword = (int) $config['security']['password_min_length'];
    $maxPassword = (int) $config['security']['password_max_length'];

    $errors = [];

    $name = nexus_input_string($input['name'] ?? '');
    $email = strtolower(nexus_input_string($input['email'] ?? ''));
    $phoneRaw = nexus_input_string($input['phone'] ?? '');
    $cpfRaw = nexus_input_string($input['cpf'] ?? '');
    $password = is_string($input['password'] ?? null) ? (string) $input['password'] : '';
    $passwordConfirm = is_string($input['passwordConfirm'] ?? null)
        ? (string) $input['passwordConfirm']
        : '';

    // Nome
    if ($name === '') {
        $errors['name'] = 'Informe seu nome completo.';
    } elseif (mb_strlen($name) < 2) {
        $errors['name'] = 'O nome deve ter pelo menos 2 caracteres.';
    } elseif (mb_strlen($name) > 120) {
        $errors['name'] = 'O nome deve ter no máximo 120 caracteres.';
    } elseif (preg_match("/^[\p{L}\p{M}' .\-]+$/u", $name) !== 1) {
        $errors['name'] = 'O nome contém caracteres inválidos.';
    }

    // E-mail
    if ($email === '') {
        $errors['email'] = 'Informe seu e-mail.';
    } elseif (mb_strlen($email) > 190) {
        $errors['email'] = 'O e-mail deve ter no máximo 190 caracteres.';
    } elseif (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $errors['email'] = 'Informe um e-mail válido.';
    }

    // Telefone
    $phoneDigits = nexus_only_digits($phoneRaw);
    $phone = '';
    if ($phoneRaw === '') {
        $errors['phone'] = 'Informe seu telefone com DDD.';
    } elseif (!nexus_is_valid_phone_digits($phoneDigits)) {
        $errors['phone'] = 'Telefone inválido. Use DDD + número, ex.: (11) 91234-5678.';
    } else {
        $phone = nexus_format_phone($phoneDigits);
    }

    // CPF
    $cpfDigits = nexus_only_digits($cpfRaw);
    $cpf = '';
    if ($cpfRaw === '') {
        $errors['cpf'] = 'Informe seu CPF.';
    } elseif (!nexus_is_valid_cpf_digits($cpfDigits)) {
        $errors['cpf'] = 'Informe um CPF válido (000.000.000-00).';
    } else {
        $cpf = nexus_format_cpf($cpfDigits);
    }

    // Senha
    if ($password === '') {
        $errors['password'] = 'Crie uma senha.';
    } elseif (mb_strlen($password) < $minPassword) {
        $errors['password'] = "A senha deve ter no mínimo {$minPassword} caracteres.";
    } elseif (mb_strlen($password) > $maxPassword) {
        $errors['password'] = "A senha deve ter no máximo {$maxPassword} caracteres.";
    } elseif (preg_match('/^(?=.*\d)(?=.*[A-Za-z]).+$/', $password) !== 1) {
        $errors['password'] = 'A senha deve conter letras e números.';
    }

    // Confirmação
    if ($passwordConfirm === '') {
        $errors['passwordConfirm'] = 'Confirme sua senha.';
    } elseif ($password !== $passwordConfirm) {
        $errors['passwordConfirm'] = 'As senhas não coincidem.';
    }

    // Consentimentos
    if (!isset($input['terms'])) {
        $errors['terms'] = 'Você precisa aceitar os Termos de Uso.';
    }
    if (!isset($input['privacy'])) {
        $errors['privacy'] = 'Você precisa aceitar a Política de Privacidade.';
    }

    return [
        'ok' => $errors === [],
        'data' => [
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'cpf' => $cpf,
            'password' => $password,
        ],
        'errors' => $errors,
    ];
}
