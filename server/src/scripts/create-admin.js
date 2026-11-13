/* ==========================================================================
   NEXUS TECH — Seed do administrador inicial (Admin)
   Uso: npm run seed:admin   (na pasta server/)
   - Exige ADMIN_EMAIL, ADMIN_NAME e os secrets JWT configurados (nada de
     valores padrão no código). A senha NUNCA vem de variável de ambiente
     persistida: é solicitada de forma interativa (sem eco no terminal).
   - Uso não interativo (automação/testes): defina ADMIN_PASSWORD apenas no
     environment daquele comando (nunca em arquivo .env).
   - Gera o hash bcrypt em runtime (custo 12); insere/atualiza o admin
     (role=admin, is_active=1). NUNCA imprime senha ou hash; o valor
     sensível só é persistido como password_hash criptografado no banco.
   ========================================================================== */

require("dotenv").config();
const bcrypt = require("bcryptjs");
const readline = require("readline");
const usersRepository = require("../repositories/admin/users.repository");

const { pool } = require("../config/db");

const BCRYPT_COST = 12;
/* Mesma política do cadastro do projeto: mín. 8 caracteres, letras+números. */
const PASSWORD_RE = /^(?=.*\d)(?=.*[A-Za-z]).{8,}$/;

const REQUIRED_VARS = [
  "ADMIN_EMAIL",
  "ADMIN_NAME",
  "ADMIN_JWT_SECRET",
  "ADMIN_REFRESH_SECRET",
];

function fail(message) {
  console.error(`[seed:admin] ${message}`);
  process.exit(1);
}

/* Leitura de senha SEM eco no terminal (TTY). Em stdin piped (automação)
   o readline consome as linhas normalmente sem expor nada em um arquivo.
   As DUAS perguntas (senha + confirmação) são encadeadas na MESMA interface:
   registrar a 2ª pergunta de forma síncrona evita perder linhas quando o
   stdin chega de uma só vez (pipe). */
function createHiddenPrompter() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl._writeToOutput = (str) => {
    if (!process.stdin.isTTY) {
      rl.output.write(str);
      return;
    }
    if (str === "\r\n" || str === "\n") rl.output.write("\n");
  };
  return {
    askPair(question, confirmQuestion) {
      return new Promise((resolve) => {
        rl.question(question, (first) => {
          rl.question(confirmQuestion, (second) => resolve([first, second]));
        });
      });
    },
    close() {
      rl.close();
    },
  };
}

/* Senha: via env SOMENTE para automação não interativa (não vai a arquivos). */
async function resolvePassword() {
  const fromEnv = process.env.ADMIN_PASSWORD;
  if (typeof fromEnv === "string" && fromEnv.length > 0) {
    console.warn(
      "[seed:admin] ADMIN_PASSWORD usado do environment (automação). NÃO defina a senha em arquivos .env."
    );
    return fromEnv;
  }
  const prompter = createHiddenPrompter();
  try {
    const [password, confirm] = await prompter.askPair(
      "[seed:admin] Senha do administrador: ",
      "[seed:admin] Confirme a senha: "
    );
    if (password !== confirm) fail("As senhas não coincidem. Tente novamente.");
    return password;
  } finally {
    prompter.close();
  }
}

async function main() {
  for (const key of REQUIRED_VARS) {
    const value = process.env[key];
    if (!value || String(value).trim() === "") {
      fail(`Variável obrigatória ausente ou vazia: ${key}. Configure o .env e repita.`);
    }
  }

  const email = String(process.env.ADMIN_EMAIL).trim().toLowerCase();
  const name = String(process.env.ADMIN_NAME).trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail("ADMIN_EMAIL não parece um e-mail válido.");
  }
  if (name.length === 0) fail("ADMIN_NAME não pode ser vazio.");

  const password = await resolvePassword();
  if (password.length < 8 || !PASSWORD_RE.test(password)) {
    fail("Senha fraca: mínimo 8 caracteres, com letras e números.");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const { id, created } = await usersRepository.upsertAdmin({
    email,
    name,
    passwordHash,
  });

  console.log(
    `[seed:admin] ${created ? "Criado" : "Atualizado"} usuário admin id=${id} (${email}) — role=admin, is_active=1.`
  );
  console.log("[seed:admin] Senha e hash nunca são impressos. Nenhum valor sensível foi persistido fora do password_hash criptografado.");

  await pool.end();
}

main().catch((err) => {
  console.error("[seed:admin] Falha:", err.message);
  process.exit(1);
});