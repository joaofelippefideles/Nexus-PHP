/* ==========================================================================
   NEXUS TECH — Validadores e formatadores compartilhados (JS)
   Espelham as regras do backend PHP (includes/validacao.php) para que a
   validação do navegador e do servidor permaneçam consistentes.
   ========================================================================== */

export function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function formatCpf(value) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function isValidCpf(value) {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(digits[i]) * (10 - i);
  }
  let first = 11 - (sum % 11);
  if (first >= 10) first = 0;
  if (first !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(digits[i]) * (11 - i);
  }
  let second = 11 - (sum % 11);
  if (second >= 10) second = 0;

  return second === Number(digits[10]);
}

export function isValidPhone(value) {
  const digits = onlyDigits(value);
  if (!/^\d{10,11}$/.test(digits)) return false;
  const ddd = digits.slice(0, 2);
  return ddd[0] !== "0" && ddd[1] !== "0";
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value ?? "").trim());
}

export function isValidName(value) {
  const name = String(value ?? "").trim();
  return name.length >= 2 && name.length <= 120 && /^[\p{L}\p{M}' .-]+$/u.test(name);
}

export function isValidPassword(value) {
  const password = String(value ?? "");
  return (
    password.length >= 8 &&
    password.length <= 72 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password)
  );
}

/**
 * Pontua a senha de 0 a 4 para o medidor visual.
 * Não substitui a validação — é apenas feedback de qualidade.
 */
export function passwordStrength(value) {
  const password = String(value ?? "");
  if (password === "") return { score: 0, label: "Digite uma senha" };
  if (password.length < 8) return { score: 1, label: "Muito fraca" };

  let score = 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  score = Math.min(score, 4);

  const labels = ["Muito fraca", "Fraca", "Média", "Boa", "Forte"];
  return { score, label: labels[score] };
}
