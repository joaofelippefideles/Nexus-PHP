<?php
/**
 * ==========================================================================
 * NEXUS TECH — Página de cadastro (HTML5 + CSS + JavaScript + PHP)
 * --------------------------------------------------------------------------
 * A mesma URL responde de duas formas:
 *   - POST tradicional  → valida, grava e redireciona (PRG) com mensagem;
 *   - POST via Fetch    → devolve JSON { ok, message, errors, user }.
 * A validação acontece no navegador (register-php.js) E no servidor
 * (includes/validacao.php), com consultas preparadas e senha em bcrypt.
 * ==========================================================================
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/validacao.php';
require_once __DIR__ . '/../includes/conexao.php';

nexus_start_session();

$isJson = nexus_is_json_request();

$errors = [];
$values = [
    'name' => '',
    'email' => '',
    'phone' => '',
    'cpf' => '',
    'terms' => false,
    'privacy' => false,
];
$success = false;
$successName = '';
$generalMessage = '';

/* --------------------------------------------------------------------------
   GET — verificação de e-mail já cadastrado (AJAX)
-------------------------------------------------------------------------- */

if ($_SERVER['REQUEST_METHOD'] === 'GET' && array_key_exists('check_email', $_GET)) {
    $email = strtolower(nexus_input_string($_GET['check_email'] ?? ''));

    if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        nexus_json([
            'ok' => false,
            'available' => false,
            'message' => 'Informe um e-mail válido.',
        ], 422);
    }

    try {
        $stmt = nexus_db()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $exists = (bool) $stmt->fetchColumn();

        nexus_json([
            'ok' => true,
            'available' => !$exists,
            'message' => $exists
                ? 'Este e-mail já está cadastrado.'
                : 'E-mail disponível.',
        ]);
    } catch (Throwable $exception) {
        nexus_log('Falha ao verificar e-mail: ' . $exception->getMessage());
        nexus_json([
            'ok' => false,
            'available' => true,
            'message' => 'Não foi possível verificar o e-mail agora.',
        ]);
    }
}

/* --------------------------------------------------------------------------
   GET — retorno após cadastro (Post/Redirect/Get)
-------------------------------------------------------------------------- */

if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['sucesso'] ?? '') === '1') {
    $flashName = nexus_flash_get('register_name', '');

    if (is_string($flashName) && $flashName !== '') {
        $success = true;
        $successName = $flashName;
    } else {
        nexus_redirect('cadastro.php');
    }
}

/* --------------------------------------------------------------------------
   POST — processamento do cadastro
-------------------------------------------------------------------------- */

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $config = nexus_config();
    $status = 422;
    $pdo = null;

    $token = $_POST['csrf_token'] ?? '';

    if (!nexus_csrf_valid(is_string($token) ? $token : '')) {
        $errors['form'] = 'Sessão expirada. Recarregue a página e tente novamente.';
        $status = 419;
    } elseif (nexus_input_string($_POST['website'] ?? '') !== '') {
        // Honeypot: apenas robôs preenchem este campo oculto.
        $errors['form'] = 'Não foi possível processar o cadastro.';
        $status = 400;
    } elseif (nexus_rate_limit_exceeded(
        'register',
        (int) $config['security']['register_max_attempts'],
        (int) $config['security']['register_window_seconds']
    )) {
        $errors['form'] = 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.';
        $status = 429;
    } else {
        $result = nexus_validate_registration($_POST);

        $values['name'] = (string) $result['data']['name'];
        $values['email'] = (string) $result['data']['email'];
        $values['phone'] = (string) $result['data']['phone'];
        $values['cpf'] = (string) $result['data']['cpf'];
        $values['terms'] = isset($_POST['terms']);
        $values['privacy'] = isset($_POST['privacy']);
        $errors = $result['errors'];

        if ($result['ok']) {
            try {
                $pdo = nexus_db();
                $pdo->beginTransaction();

                $passwordHash = password_hash(
                    (string) $result['data']['password'],
                    PASSWORD_BCRYPT,
                    ['cost' => (int) $config['security']['bcrypt_cost']]
                );

                $stmt = $pdo->prepare(
                    "INSERT INTO users (name, email, password_hash, role, is_active)
                     VALUES (?, ?, ?, 'customer', 1)"
                );
                $stmt->execute([
                    $result['data']['name'],
                    $result['data']['email'],
                    $passwordHash,
                ]);

                $userId = (int) $pdo->lastInsertId();

                $stmt = $pdo->prepare(
                    'INSERT INTO user_profile (user_id, phone, cpf) VALUES (?, ?, ?)'
                );
                $stmt->execute([
                    $userId,
                    $result['data']['phone'],
                    $result['data']['cpf'],
                ]);

                $pdo->commit();

                $success = true;
                $successName = (string) $result['data']['name'];

                if ($isJson) {
                    nexus_json([
                        'ok' => true,
                        'message' => 'Conta criada com sucesso!',
                        'user' => [
                            'name' => $result['data']['name'],
                            'email' => $result['data']['email'],
                        ],
                    ], 201);
                }

                nexus_flash_set('register_name', $successName);
                nexus_redirect('cadastro.php?sucesso=1');
            } catch (PDOException $exception) {
                if ($pdo instanceof PDO && $pdo->inTransaction()) {
                    $pdo->rollBack();
                }

                if (nexus_is_duplicate_error($exception)) {
                    // Não registra a mensagem do banco em caso de duplicidade:
                    // ela contém e-mail/CPF (dados pessoais).
                    nexus_log('Cadastro recusado: e-mail ou CPF já cadastrado.');
                    $message = strtolower($exception->getMessage());

                    if (str_contains($message, 'cpf') || str_contains($message, 'user_profile')) {
                        $errors['cpf'] = 'CPF já cadastrado para outro usuário.';
                    } else {
                        $errors['email'] = 'E-mail já cadastrado.';
                    }

                    $status = 409;
                } else {
                    nexus_log('Falha ao cadastrar usuário: ' . $exception->getMessage());
                    $errors['form'] = 'Não foi possível concluir o cadastro. Tente novamente em instantes.';
                    $status = 500;
                }
            } catch (Throwable $exception) {
                if ($pdo instanceof PDO && $pdo->inTransaction()) {
                    $pdo->rollBack();
                }

                nexus_log('Erro inesperado no cadastro: ' . $exception->getMessage());
                $errors['form'] = 'Não foi possível concluir o cadastro. Tente novamente em instantes.';
                $status = 500;
            }
        }
    }

    if (!$success) {
        $generalMessage = $errors['form'] ?? 'Revise os campos destacados e tente novamente.';

        if ($isJson) {
            nexus_json([
                'ok' => false,
                'message' => $generalMessage,
                'errors' => $errors,
            ], $status);
        }
    }
}

/* --------------------------------------------------------------------------
   HELPERS DE RENDERIZAÇÃO
-------------------------------------------------------------------------- */

function nexus_field_error(array $errors, string $key): string
{
    return isset($errors[$key]) ? (string) $errors[$key] : '';
}

function nexus_field_class(array $errors, string $key): string
{
    return isset($errors[$key]) ? ' has-error' : '';
}

function nexus_field_invalid(array $errors, string $key): string
{
    return isset($errors[$key]) ? ' aria-invalid="true"' : '';
}

$root = '../';
$active = '';
$bodyPage = 'cadastro';
$pageTitle = 'Criar conta — Nexus Tech';
$pageDesc = 'Crie sua conta na Nexus Tech para acompanhar pedidos, salvar endereços, guardar favoritos e agilizar suas compras.';

require __DIR__ . '/../includes/header.php';
?>

  <main>
    <section class="auth" aria-labelledby="auth-title">
      <div class="container">

        <div class="auth__header">

          <nav class="breadcrumb" aria-label="Trilha de navegação">
            <ol class="breadcrumb__list">
              <li class="breadcrumb__item">
                <a href="../index.html" class="breadcrumb__link">Home</a>
                <span class="breadcrumb__separator" aria-hidden="true">/</span>
              </li>
              <li class="breadcrumb__item">
                <span class="breadcrumb__current" aria-current="page">Criar conta</span>
              </li>
            </ol>
          </nav>

          <h1 id="auth-title" class="auth__title">
            Crie sua <span class="auth__title-accent">conta</span>
          </h1>

          <p class="auth__lead">
            Com uma conta Nexus Tech você acompanha seus pagamentos e pedidos,
            salva endereços, guarda produtos favoritos e agiliza suas compras.
          </p>

          <p class="auth__security-note" role="note">
            Cadastro real: seus dados são validados no navegador e no servidor,
            gravados no banco de dados e sua senha é armazenada apenas como hash
            bcrypt. Nunca compartilhamos sua senha.
          </p>

        </div>

        <!-- Mensagem de estado para leitores de tela -->
        <p class="sr-only" id="register-status" role="status" aria-live="polite"></p>

        <div class="auth__layout">

          <form
            class="auth__card contact-form"
            id="register-form"
            method="post"
            action="cadastro.php"
            novalidate
            <?= $success ? 'hidden' : '' ?>
          >

            <input type="hidden" name="csrf_token" value="<?= e(nexus_csrf_token()) ?>">

            <!-- Honeypot anti-robô (oculto para pessoas) -->
            <div class="auth__hp" aria-hidden="true">
              <label for="register-website">Não preencha este campo</label>
              <input type="text" id="register-website" name="website" tabindex="-1" autocomplete="off">
            </div>

            <p
              class="alert alert--danger contact-form__feedback"
              id="register-feedback"
              role="alert"
              aria-live="polite"
              <?= $generalMessage === '' ? 'hidden' : '' ?>
            ><?= e($generalMessage) ?></p>

            <fieldset class="auth__fieldset">
              <legend class="auth__legend">Dados pessoais</legend>
              <div class="auth__grid">

                <div class="contact-form__field auth__field--full<?= nexus_field_class($errors, 'name') ?>">
                  <label class="contact-form__label" for="register-name">Nome completo</label>
                  <input
                    class="contact-form__input"
                    type="text"
                    id="register-name"
                    name="name"
                    data-validate="name"
                    autocomplete="name"
                    maxlength="120"
                    required
                    placeholder="Seu nome completo"
                    aria-describedby="register-name-err"
                    value="<?= e($values['name']) ?>"
                    <?= nexus_field_invalid($errors, 'name') ?>
                  >
                  <p class="contact-form__error" id="register-name-err"><?= e(nexus_field_error($errors, 'name')) ?></p>
                </div>

                <div class="contact-form__field<?= nexus_field_class($errors, 'email') ?>">
                  <label class="contact-form__label" for="register-email">E-mail</label>
                  <input
                    class="contact-form__input"
                    type="email"
                    id="register-email"
                    name="email"
                    data-validate="email"
                    autocomplete="email"
                    maxlength="190"
                    required
                    placeholder="voce@exemplo.com"
                    aria-describedby="register-email-err register-email-status"
                    value="<?= e($values['email']) ?>"
                    <?= nexus_field_invalid($errors, 'email') ?>
                  >
                  <p class="contact-form__error" id="register-email-err"><?= e(nexus_field_error($errors, 'email')) ?></p>
                  <p class="contact-form__hint" id="register-email-status" role="status" aria-live="polite"></p>
                </div>

                <div class="contact-form__field<?= nexus_field_class($errors, 'phone') ?>">
                  <label class="contact-form__label" for="register-phone">Telefone</label>
                  <input
                    class="contact-form__input"
                    type="tel"
                    id="register-phone"
                    name="phone"
                    data-validate="phone"
                    autocomplete="tel"
                    inputmode="tel"
                    maxlength="15"
                    required
                    placeholder="(11) 99999-9999"
                    aria-describedby="register-phone-err"
                    value="<?= e($values['phone']) ?>"
                    <?= nexus_field_invalid($errors, 'phone') ?>
                  >
                  <p class="contact-form__error" id="register-phone-err"><?= e(nexus_field_error($errors, 'phone')) ?></p>
                </div>

                <div class="contact-form__field<?= nexus_field_class($errors, 'cpf') ?>">
                  <label class="contact-form__label" for="register-cpf">CPF</label>
                  <input
                    class="contact-form__input"
                    type="text"
                    id="register-cpf"
                    name="cpf"
                    data-validate="cpf"
                    autocomplete="off"
                    inputmode="numeric"
                    maxlength="14"
                    required
                    placeholder="000.000.000-00"
                    aria-describedby="register-cpf-err"
                    value="<?= e($values['cpf']) ?>"
                    <?= nexus_field_invalid($errors, 'cpf') ?>
                  >
                  <p class="contact-form__error" id="register-cpf-err"><?= e(nexus_field_error($errors, 'cpf')) ?></p>
                  <small class="contact-form__hint">
                    Usado como identificador único da sua conta. Não exibimos seu CPF publicamente.
                  </small>
                </div>

              </div>
            </fieldset>

            <fieldset class="auth__fieldset">
              <legend class="auth__legend">Acesso</legend>
              <p class="auth__security-note">
                A senha é enviada por conexão segura e salva apenas como hash bcrypt.
                Ela nunca é exibida novamente.
              </p>
              <div class="auth__grid">

                <div class="contact-form__field<?= nexus_field_class($errors, 'password') ?>">
                  <label class="contact-form__label" for="register-password">Senha</label>
                  <div class="auth__password-wrap">
                    <input
                      class="contact-form__input auth__password-input"
                      type="password"
                      id="register-password"
                      name="password"
                      data-validate="password"
                      autocomplete="new-password"
                      minlength="8"
                      maxlength="72"
                      required
                      placeholder="Crie uma senha"
                      aria-describedby="register-password-err register-password-hint"
                      <?= nexus_field_invalid($errors, 'password') ?>
                    >
                    <button
                      type="button"
                      class="auth__password-toggle"
                      data-toggle-password="register-password"
                      aria-pressed="false"
                      aria-label="Mostrar senha"
                    >Mostrar</button>
                  </div>
                  <p class="contact-form__error" id="register-password-err"><?= e(nexus_field_error($errors, 'password')) ?></p>

                  <div class="auth__strength" id="register-strength" data-score="0" hidden>
                    <span class="auth__strength-bar" aria-hidden="true">
                      <span class="auth__strength-fill"></span>
                    </span>
                    <span class="auth__strength-text" id="register-strength-text" aria-live="polite"></span>
                  </div>

                  <div class="auth__hint" id="register-password-hint">
                    <p class="auth__hint-title">Requisitos da senha</p>
                    <ul class="auth__hint-list">
                      <li>No mínimo 8 caracteres</li>
                      <li>Pelo menos uma letra</li>
                      <li>Pelo menos um número</li>
                    </ul>
                  </div>
                </div>

                <div class="contact-form__field<?= nexus_field_class($errors, 'passwordConfirm') ?>">
                  <label class="contact-form__label" for="register-password-confirm">Confirmar senha</label>
                  <div class="auth__password-wrap">
                    <input
                      class="contact-form__input auth__password-input"
                      type="password"
                      id="register-password-confirm"
                      name="passwordConfirm"
                      data-validate="confirm"
                      autocomplete="new-password"
                      minlength="8"
                      maxlength="72"
                      required
                      placeholder="Repita a senha"
                      aria-describedby="register-password-confirm-err"
                      <?= nexus_field_invalid($errors, 'passwordConfirm') ?>
                    >
                    <button
                      type="button"
                      class="auth__password-toggle"
                      data-toggle-password="register-password-confirm"
                      aria-pressed="false"
                      aria-label="Mostrar confirmação de senha"
                    >Mostrar</button>
                  </div>
                  <p class="contact-form__error" id="register-password-confirm-err"><?= e(nexus_field_error($errors, 'passwordConfirm')) ?></p>
                </div>

                <div class="auth__field--full">
                  <div class="contact-form__field auth__consent-field<?= nexus_field_class($errors, 'terms') ?>">
                    <label class="auth__consent">
                      <input
                        class="auth__consent-input"
                        type="checkbox"
                        id="register-terms"
                        name="terms"
                        data-validate="terms"
                        aria-describedby="register-terms-err"
                        <?= $values['terms'] ? 'checked' : '' ?>
                        <?= nexus_field_invalid($errors, 'terms') ?>
                      >
                      <span class="auth__consent-text">
                        Li e aceito os <a href="termos.html">Termos de Uso</a> da Nexus Tech.
                      </span>
                    </label>
                    <p class="contact-form__error" id="register-terms-err"><?= e(nexus_field_error($errors, 'terms')) ?></p>
                  </div>

                  <div class="contact-form__field auth__consent-field<?= nexus_field_class($errors, 'privacy') ?>">
                    <label class="auth__consent">
                      <input
                        class="auth__consent-input"
                        type="checkbox"
                        id="register-privacy"
                        name="privacy"
                        data-validate="privacy"
                        aria-describedby="register-privacy-err"
                        <?= $values['privacy'] ? 'checked' : '' ?>
                        <?= nexus_field_invalid($errors, 'privacy') ?>
                      >
                      <span class="auth__consent-text">
                        Estou de acordo com a <a href="privacidade.html">Política de Privacidade</a>.
                      </span>
                    </label>
                    <p class="contact-form__error" id="register-privacy-err"><?= e(nexus_field_error($errors, 'privacy')) ?></p>
                  </div>
                </div>

              </div>
            </fieldset>

            <div class="contact-form__actions">
              <button type="submit" class="btn btn--primary btn--lg" id="register-submit">Criar conta</button>
              <a href="produtos.html" class="btn btn--ghost">Voltar para loja</a>
            </div>

            <p class="contact-form__note auth__login-note">
              Já tem uma conta?
              <a href="login.html">Entrar</a>
            </p>

          </form>

          <!-- ================= CADASTRO BEM-SUCEDIDO ================= -->
          <div class="auth-success" id="register-success" <?= $success ? '' : 'hidden' ?>>
            <svg class="auth-success__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M8 12.5l2.5 2.5L16 9"></path>
            </svg>
            <h2 class="auth-success__title" id="register-success-title" tabindex="-1">Conta criada com sucesso!</h2>
            <p class="auth-success__text">
              Seus dados foram gravados no banco de dados e sua senha está
              protegida. Agora você pode entrar na sua conta.
            </p>
            <p class="auth-success__meta" id="register-success-meta">
              <?= $success ? 'Bem-vindo(a), ' . e(explode(' ', trim($successName))[0]) . '!' : '' ?>
            </p>
            <div class="auth-success__actions">
              <a href="login.html" class="btn btn--primary btn--lg" id="register-go-login">Entrar na minha conta</a>
              <a href="produtos.html" class="btn btn--ghost">Continuar na loja</a>
            </div>
          </div>

        </div>

      </div>
    </section>
  </main>

<?php require __DIR__ . '/../includes/footer.php'; ?>

  <!-- JS -->
  <script src="../assets/js/modules/header.js"></script>
  <script type="module" src="../assets/js/modules/auth/register-php.js"></script>
</body>
</html>
