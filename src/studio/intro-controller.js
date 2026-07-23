(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  studio.intro = {
    createIntroController
  };

  function createIntroController(options = {}) {
    const storageKey = options.storageKey || "dls-studio-intro-complete";

    return {
      bind: bindIntroGate,
      getCompleted,
      setCompleted
    };

    function bindIntroGate() {
      const introGate = document.querySelector("#introGate");
      if (!introGate) {
        return;
      }

      const introHub = document.querySelector("#introHub");
      const introHelpButton = document.querySelector("#introHelpButton");
      const introHelpModal = document.querySelector("#introHelpModal");
      const introModeButtons = Array.from(document.querySelectorAll("[data-intro-mode]"));
      const introModePanels = Array.from(document.querySelectorAll("[data-intro-mode-panel]"));
      const clientLoginForm = document.querySelector("[data-client-login-form]");
      const clientLoginNotice = document.querySelector("[data-client-login-notice]");
      const params = new URLSearchParams(global.location.search);
      const skipIntro = isTruthyFlag(params.get("skipIntro"));
      const hubLaunch = params.has("hub") && !isFalseFlag(params.get("hub"));
      const presentationLaunch = isTruthyFlag(params.get("presentation"));
      const automatedLaunch = global.navigator.webdriver === true;
      const studioDestination = introHub?.querySelector('[data-intro-destination="studio"]');
      const introLogoSource = introGate.querySelector(".intro-logo-source");
      const introLogoStage = introLogoSource?.querySelector(".intro-logo-stage");
      const introHelpLogoHost = introHelpModal?.querySelector("[data-intro-help-logo]");
      const introBackground = [
        document.querySelector(".studio-topbar"),
        document.querySelector("#studioWorkspace")
      ].filter(Boolean);
      let introHelpPreviousFocus = null;

      if (introLogoStage && introHelpLogoHost) {
        introHelpLogoHost.append(introLogoStage);
        introLogoSource?.remove();
      }

      const setIntroBackgroundInert = (active) => {
        const elements = [...introBackground, document.querySelector("#studioExperienceSwitcher")]
          .filter((element, index, items) => element && items.indexOf(element) === index);
        elements.forEach((element) => {
          if (active && element.contains(document.activeElement)) {
            document.activeElement?.blur?.();
          }
          element.toggleAttribute("inert", active);
          if (active) element.setAttribute("aria-hidden", "true");
          else element.removeAttribute("aria-hidden");
        });
      };

      const markIntroCompleted = () => {
        setCompleted(true);
        document.body.classList.add("is-intro-complete");
      };

      const setIntroHistoryState = (view, mode = "replace") => {
        const state = { ...(global.history.state || {}), dlsView: view };
        const method = mode === "push" ? "pushState" : "replaceState";

        try {
          global.history[method](
            state,
            "",
            view === "studio" ? "#studioWorkspace" : global.location.href
          );
        } catch (error) {
          // Navigation still works if history state cannot be updated.
        }
      };

      const focusHub = () => {
        (introHub?.querySelector(".intro-destination-card") || introHub?.querySelector("button"))
          ?.focus({ preventScroll: true });
      };

      const replayIntroHelpLogo = () => {
        const stage = introHelpLogoHost?.querySelector(".intro-logo-stage");
        if (!stage) {
          return;
        }

        const replay = stage.cloneNode(true);
        stage.replaceWith(replay);
      };

      const openIntroHelp = () => {
        if (!introHelpModal) {
          return;
        }

        introHelpPreviousFocus = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : introHelpButton;
        introHelpModal.hidden = false;
        replayIntroHelpLogo();
        introHelpButton?.setAttribute("aria-expanded", "true");
        const helpBody = introHelpModal.querySelector(".intro-help-body");
        if (helpBody) {
          helpBody.scrollTop = 0;
        }
        introHelpModal.querySelector(".intro-help-dialog")?.focus({ preventScroll: true });
      };

      const closeIntroHelp = ({ restoreFocus = true } = {}) => {
        if (!introHelpModal || introHelpModal.hidden) {
          return;
        }

        introHelpModal.hidden = true;
        introHelpButton?.setAttribute("aria-expanded", "false");
        if (restoreFocus) {
          introHelpPreviousFocus?.focus?.({ preventScroll: true });
        }
        introHelpPreviousFocus = null;
      };

      const openStudioWithoutGate = ({ focus = false, markComplete = true } = {}) => {
        if (markComplete) {
          markIntroCompleted();
        }

        closeIntroHelp({ restoreFocus: false });
        introGate.hidden = true;
        introGate.classList.remove("is-closing");
        document.body.classList.remove("is-intro-active");
        document.body.classList.add("is-intro-complete");
        setIntroBackgroundInert(false);

        if (focus) {
          document.querySelector("#studioWorkspace")?.focus({ preventScroll: true });
        }
      };

      const enterStudio = ({ focus = true, updateHistory = false } = {}) => {
        if (updateHistory && global.location.hash !== "#studioWorkspace") {
          setIntroHistoryState("studio", "push");
        }

        if (introGate.hidden || introGate.classList.contains("is-closing")) {
          markIntroCompleted();
          closeIntroHelp({ restoreFocus: false });
          setIntroBackgroundInert(false);
          if (focus) {
            document.querySelector("#studioWorkspace")?.focus({ preventScroll: true });
          }
          return;
        }

        closeIntroHelp({ restoreFocus: false });
        introGate.classList.add("is-closing");
        setIntroBackgroundInert(true);
        document.body.classList.remove("is-intro-active");
        document.body.classList.add("is-intro-complete");
        setCompleted(true);

        let fallbackTimer = 0;
        const finish = () => {
          global.clearTimeout(fallbackTimer);
          introGate.hidden = true;
          introGate.classList.remove("is-closing");
          setIntroBackgroundInert(false);
          document.querySelector("#studioWorkspace")?.focus({ preventScroll: true });
        };

        const finishOnAnimation = (event) => {
          if (event.target !== introGate) {
            return;
          }

          introGate.removeEventListener("animationend", finishOnAnimation);
          finish();
        };

        introGate.addEventListener("animationend", finishOnAnimation);
        fallbackTimer = global.setTimeout(finish, 900);
      };

      const showDestinationHub = ({ focus = true, markComplete = true } = {}) => {
        if (!introHub) {
          enterStudio();
          return;
        }

        if (markComplete) {
          markIntroCompleted();
        } else if (getCompleted()) {
          document.body.classList.add("is-intro-complete");
        }

        introGate.hidden = false;
        introGate.classList.remove("is-closing");
        introHub.hidden = false;
        introGate.classList.add("is-choosing");
        document.body.classList.add("is-intro-active");
        setIntroBackgroundInert(true);

        if (global.location.hash !== "#studioWorkspace") {
          setIntroHistoryState("hub");
        }

        if (focus) {
          focusHub();
        }
      };

      const setIntroMode = (mode) => {
        introModeButtons.forEach((button) => {
          const active = button.dataset.introMode === mode;
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-selected", active ? "true" : "false");
        });

        introModePanels.forEach((panel) => {
          const active = panel.dataset.introModePanel === mode;
          panel.classList.toggle("is-active", active);
          panel.hidden = !active;
        });
      };

      const setClientLoginNotice = (message, type = "info") => {
        if (!clientLoginNotice) {
          return;
        }

        clientLoginNotice.textContent = message || "";
        clientLoginNotice.dataset.type = type;
      };

      const getClientLoginErrorMessage = (error) => {
        if (error?.name === "TypeError" || /fetch/i.test(error?.message || "")) {
          return "No se pudo conectar con la API. Ejecuta npm.cmd start y abre http://127.0.0.1:5173/ para entrar al portal.";
        }

        return error?.message || "Credenciales no validas.";
      };

      const handleClientLogin = async (event) => {
        event.preventDefault();

        const formData = new FormData(clientLoginForm);
        const button = clientLoginForm.querySelector("button[type='submit']");
        const business = String(formData.get("business") || "").trim();
        const password = String(formData.get("password") || "").trim();

        if (!business || !password) {
          setClientLoginNotice("Introduce negocio y contrasena.", "error");
          return;
        }

        if (button) {
          button.disabled = true;
          button.textContent = "Entrando...";
        }

        setClientLoginNotice("Validando acceso...", "info");

        try {
          const response = await fetch(
            global.LocalLiftApi?.url?.("/api/client/login") || "/api/client/login",
            {
              method: "POST",
              headers: { Accept: "application/json", "Content-Type": "application/json" },
              body: JSON.stringify({ business, password })
            }
          );
          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(payload.error || "No se pudo iniciar sesion.");
          }

          global.LocalLiftApi?.setClientSession?.(payload.session);
          setClientLoginNotice("Acceso correcto. Abriendo portal...", "ok");
          const identifier = payload.business?.slug
            || payload.business?.id
            || payload.session.businessSlug
            || payload.session.businessId;
          global.location.href = `pages/client-dashboard.html?business=${encodeURIComponent(identifier)}&businessName=${encodeURIComponent(payload.business?.name || payload.session.businessName || business)}`;
        } catch (error) {
          setClientLoginNotice(getClientLoginErrorMessage(error), "error");
        } finally {
          if (button) {
            button.disabled = false;
            button.textContent = "Entrar al portal";
          }
        }
      };

      introHelpButton?.setAttribute("aria-expanded", "false");
      introHelpButton?.addEventListener("click", openIntroHelp);
      introHelpModal?.addEventListener("click", (event) => {
        if (event.target.closest("[data-intro-help-close]")) {
          closeIntroHelp();
        }
      });
      introModeButtons.forEach((button) => {
        button.addEventListener("click", () => setIntroMode(button.dataset.introMode || "developer"));
      });
      clientLoginForm?.addEventListener("submit", handleClientLogin);

      const requestedIntroMode = params.get("mode");
      if (requestedIntroMode === "client" || requestedIntroMode === "developer") {
        setIntroMode(requestedIntroMode);
      }

      studioDestination?.addEventListener("click", (event) => {
        event.preventDefault();
        enterStudio({ updateHistory: true });
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && introHelpModal && !introHelpModal.hidden) {
          event.preventDefault();
          closeIntroHelp();
          return;
        }

        if (event.key === "Escape" && document.body.classList.contains("is-intro-active")) {
          showDestinationHub();
        }
      });

      const syncIntroWithLocation = () => {
        if (global.location.hash === "#studioWorkspace") {
          enterStudio({ focus: false });
          return;
        }

        if (getCompleted()) {
          showDestinationHub({ focus: false, markComplete: false });
        }
      };

      global.addEventListener("popstate", syncIntroWithLocation);
      global.addEventListener("hashchange", syncIntroWithLocation);

      if (!hubLaunch && (
        skipIntro
        || presentationLaunch
        || automatedLaunch
        || global.location.hash === "#studioWorkspace"
      )) {
        openStudioWithoutGate({ markComplete: true });
        setIntroHistoryState("studio");
        return;
      }

      showDestinationHub({ focus: false });
      setIntroHistoryState("hub");
    }

    function getCompleted() {
      try {
        return global.localStorage?.getItem(storageKey) === "true";
      } catch (error) {
        return false;
      }
    }

    function setCompleted(value) {
      try {
        if (value) {
          global.localStorage?.setItem(storageKey, "true");
        } else {
          global.localStorage?.removeItem(storageKey);
        }
      } catch (error) {
        // The Studio still works when browser storage is not writable.
      }
    }
  }

  function isTruthyFlag(value) {
    return ["1", "true", "yes"].includes(String(value || "").toLowerCase());
  }

  function isFalseFlag(value) {
    return ["0", "false", "no"].includes(String(value || "").toLowerCase());
  }
})(globalThis);
