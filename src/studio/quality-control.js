(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};
  const scoreElement = document.querySelector("#qualityScore");
  const stateElement = document.querySelector("#qualityState");
  const progressElement = document.querySelector("#qualityProgress");
  const explainerElement = document.querySelector("#qualityExplainer");
  const checklistElement = document.querySelector("#qualityChecklist");

  studio.qualityControl = { renderQualityControl };

  function renderQualityControl(checks, validation) {
    if (!scoreElement || !stateElement || !progressElement || !explainerElement || !checklistElement) return;

    const completed = checks.filter((item) => item.done).length;
    const pending = checks.filter((item) => !item.done);
    const score = Math.min(Math.round((completed / checks.length) * 100), validation.score);
    const blocked = validation.errors.length > 0;
    const ready = validation.ok && score >= 82;
    const tone = blocked ? "blocked" : ready ? "ready" : "progress";
    const state = blocked ? "Entrega bloqueada" : ready ? "Lista para entregar" : "Aún incompleta";
    const reviewCount = validation.warnings.length + pending.length;
    const nextStep = validation.errors[0]?.message || pending[0]?.label || validation.warnings[0]?.message;

    scoreElement.textContent = `${score}%`;
    scoreElement.className = `is-${tone}`;
    stateElement.textContent = state;
    explainerElement.textContent = blocked
      ? validation.errors.length === 1
        ? "Un requisito imprescindible impide exportar."
        : `${validation.errors.length} requisitos imprescindibles impiden exportar.`
      : ready
        ? "Cumple el mínimo de calidad. Ya puedes hacer la revisión final."
        : pending.length === 1
          ? "Completa el siguiente punto y revisa los avisos antes de entregar."
          : pending.length > 1
            ? `Completa ${pending.length} puntos y revisa los avisos antes de entregar.`
            : "Revisa los avisos técnicos antes de entregar.";
    progressElement.className = `quality-progress is-${tone}`;
    progressElement.style.setProperty("--quality-progress", `${score}%`);
    progressElement.setAttribute("aria-valuenow", String(score));
    progressElement.setAttribute("aria-valuetext", `${score}%. ${state}`);
    checklistElement.innerHTML = `
      <div class="quality-counts" aria-label="Resumen del control de entrega">
        <span class="quality-count is-error${validation.errors.length ? "" : " is-empty"}"><b>${validation.errors.length}</b> bloqueos</span>
        <span class="quality-count is-warning${reviewCount ? "" : " is-empty"}"><b>${reviewCount}</b> por revisar</span>
        <span class="quality-count is-done"><b>${completed}/${checks.length}</b> cumplidos</span>
      </div>
      <div class="quality-priority is-${tone}">
        <strong>${ready ? (nextStep ? "Mejora opcional" : "Todo esencial está cubierto") : blocked ? "Corrige esto primero" : "Siguiente mejora"}</strong>
        <p>${escapeHtml(nextStep || "Abre Entrega Pro para comprobar el paquete antes de enviarlo.")}</p>
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})(globalThis);
