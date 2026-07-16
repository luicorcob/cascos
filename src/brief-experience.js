(function () {
  "use strict";

  const form = document.querySelector("#briefForm");
  const hero = document.querySelector(".brief-hero");
  const progressNav = document.querySelector(".brief-step-nav");
  const generateButton = document.querySelector("#generateWebsiteButton");

  if (!form || !hero || !progressNav) return;

  const sections = Array.from(form.querySelectorAll(":scope > section"));
  const navLinks = Array.from(progressNav.querySelectorAll("a[href^='#']"));
  if (sections.length < 2) return;

  const controls = document.createElement("nav");
  controls.className = "brief-wizard-controls";
  controls.setAttribute("aria-label", "Navegación del brief");
  controls.innerHTML = `
    <button type="button" class="brief-wizard-back" data-brief-step-back>
      <span aria-hidden="true">&#8592;</span> Anterior
    </button>
    <span class="brief-wizard-position" aria-live="polite"></span>
    <button type="button" class="brief-wizard-next" data-brief-step-next>
      Siguiente <span aria-hidden="true">&#8594;</span>
    </button>
  `;
  form.append(controls);

  const backButton = controls.querySelector("[data-brief-step-back]");
  const nextButton = controls.querySelector("[data-brief-step-next]");
  const position = controls.querySelector(".brief-wizard-position");
  let activeIndex = resolveInitialIndex();

  document.body.classList.add("brief-guided-ready");
  sections.forEach((section, index) => {
    section.dataset.briefStep = String(index + 1);
    section.setAttribute("tabindex", "-1");
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const section = resolveSection(link.hash);
      if (!section) return;
      event.preventDefault();
      setStep(sections.indexOf(section), { focus: true, updateHash: true });
    });
  });

  backButton?.addEventListener("click", () => setStep(activeIndex - 1, { focus: true }));
  nextButton?.addEventListener("click", () => {
    if (activeIndex < sections.length - 1) {
      setStep(activeIndex + 1, { focus: true });
      return;
    }
    generateButton?.click();
  });

  form.addEventListener("input", updateCompletionState);
  form.addEventListener("change", updateCompletionState);
  generateButton?.addEventListener("click", revealInvalidStep);
  window.addEventListener("hashchange", () => {
    const section = resolveSection(window.location.hash);
    if (section) setStep(sections.indexOf(section), { focus: false });
  });

  setStep(activeIndex, { focus: false });
  updateCompletionState();

  function setStep(nextIndex, options = {}) {
    activeIndex = Math.max(0, Math.min(sections.length - 1, Number(nextIndex) || 0));

    sections.forEach((section, index) => {
      const active = index === activeIndex;
      section.classList.toggle("is-active-step", active);
      section.setAttribute("aria-hidden", String(!active));
      section.toggleAttribute("inert", !active);
    });

    navLinks.forEach((link) => {
      const active = resolveSection(link.hash) === sections[activeIndex];
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "step");
      else link.removeAttribute("aria-current");
    });

    if (backButton) backButton.disabled = activeIndex === 0;
    if (nextButton) {
      const last = activeIndex === sections.length - 1;
      nextButton.classList.toggle("is-finish", last);
      nextButton.innerHTML = last
        ? 'Revisar y generar <span aria-hidden="true">&#8599;</span>'
        : 'Siguiente <span aria-hidden="true">&#8594;</span>';
    }
    if (position) position.textContent = `Paso ${activeIndex + 1} de ${sections.length}`;

    if (options.updateHash) {
      const id = sections[activeIndex].id;
      if (id) history.replaceState(history.state, "", `#${id}`);
    }

    if (options.focus) {
      const target = sections[activeIndex];
      window.requestAnimationFrame(() => {
        target.focus({ preventScroll: true });
        const top = target.getBoundingClientRect().top + window.scrollY - 18;
        window.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      });
    }
  }

  function updateCompletionState() {
    navLinks.forEach((link) => {
      const section = resolveSection(link.hash);
      if (!section) return;
      const required = Array.from(section.querySelectorAll("[required]"))
        .filter((field) => !field.closest("[hidden]"));
      const optionalFields = Array.from(section.querySelectorAll("input, select, textarea"))
        .filter((field) => !field.closest("[hidden]"));
      let complete = required.length > 0
        ? required.every(hasValue)
        : optionalFields.some(hasValue);

      if (section.id === "brief-identidad" && form.elements.categoryPreset?.value === "custom") {
        complete = complete && hasValue(form.elements.categoryCustom);
      }

      if (section.id === "brief-conversion") {
        complete = complete && ["phone", "email", "bookingUrl"]
          .some((name) => hasValue(form.elements[name]));
      }

      if (section.id === "brief-contenido") {
        const services = String(form.elements.services?.value || "")
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean);
        const hasHours = hasValue(section.querySelector("textarea[name='hoursNotes']"))
          || Array.from(section.querySelectorAll(".hours-row")).some((row) => {
            const times = Array.from(row.querySelectorAll("input[type='time']"));
            const closed = row.querySelector("input[name$='Closed']")?.checked;
            return closed || (hasValue(times[0]) && hasValue(times[1])) || (hasValue(times[2]) && hasValue(times[3]));
          });
        complete = complete && services.length >= 3 && hasHours;
      }

      link.classList.toggle("is-complete", complete);
    });
  }

  function revealInvalidStep() {
    window.queueMicrotask(() => {
      const invalid = form.querySelector("[aria-invalid='true'], .is-invalid input, .is-invalid textarea, .is-invalid select");
      const section = invalid?.closest(":scope > section") || invalid?.closest("section");
      const index = sections.indexOf(section);
      if (index < 0) return;
      setStep(index, { focus: false, updateHash: true });
      window.requestAnimationFrame(() => {
        invalid.focus?.({ preventScroll: true });
        invalid.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
      });
    });
  }

  function resolveInitialIndex() {
    const target = resolveSection(window.location.hash);
    return Math.max(0, sections.indexOf(target));
  }

  function resolveSection(hash) {
    if (!hash || hash === "#") return null;
    const target = document.querySelector(hash);
    return target?.matches?.(".brief-form > section") ? target : target?.closest?.(".brief-form > section");
  }

  function hasValue(field) {
    if (!field) return false;
    if (field.type === "checkbox" || field.type === "radio") return field.checked;
    return String(field.value || "").trim().length > 0;
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
})();
