/* ==========================================================================
   NEXUS TECH — Contato
   Validação básica do formulário (frontend) e feedback visual de envio
   simulado. Nenhuma chamada à API e nenhum dado é enviado ao servidor.
   ========================================================================== */

(function initContactForm() {
  "use strict";

  const form = document.getElementById("contact-form");
  if (!form) return;

  const fields = Array.from(
    form.querySelectorAll("[data-validate]:not([disabled])")
  );
  const feedback = document.getElementById("contact-feedback");
  const submitBtn = document.getElementById("contact-submit");

  const validators = {
    text: (value) => value.trim().length >= 2,
    email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()),
    subject: (value) => value.trim().length > 0,
    message: (value) => value.trim().length >= 10,
  };

  function setError(input, hasError) {
    const fieldGroup = input.closest(".contact-form__field");
    if (!fieldGroup) return;
    fieldGroup.classList.toggle("has-error", hasError);
    input.removeAttribute("aria-describedby");
    fieldGroup
      .querySelectorAll(".contact-form__error")
      .forEach((err) => err.setAttribute("id", `error-${input.id}`));
    if (hasError) {
      input.setAttribute("aria-describedby", `error-${input.id}`);
    }
  }

  function validateField(input) {
    const rule = input.getAttribute("data-validate");
    const valid = validators[rule] ? validators[rule](input.value) : true;
    setError(input, !valid);
    return valid;
  }

  function validateAll() {
    let valid = true;
    fields.forEach((input) => {
      if (!validateField(input)) valid = false;
    });
    return valid;
  }

  /* Valida ao sair do campo */
  fields.forEach((input) => {
    input.addEventListener("blur", () => validateField(input));
    input.addEventListener("input", () => {
      if (input.closest(".contact-form__field").classList.contains("has-error")) {
        validateField(input);
      }
    });
  });

  /* Envio simulado — não persiste nem envia dados */
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
    }
    if (!validateAll()) {
      feedback.hidden = false;
      feedback.setAttribute("role", "alert");
      feedback.classList.remove("alert--success");
      feedback.classList.add("alert--danger");
      feedback.textContent =
        "Corrija os campos destacados antes de enviar a mensagem.";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando...";

    window.setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = "Enviar mensagem";
      feedback.hidden = false;
      feedback.setAttribute("role", "status");
      feedback.classList.remove("alert--danger");
      feedback.classList.add("alert--success");
      feedback.textContent =
        "Mensagem enviada com sucesso! Retornaremos em até 1 dia útil.";
      form.reset();
      fields.forEach((input) => setError(input, false));
    }, 900);
  });
})();