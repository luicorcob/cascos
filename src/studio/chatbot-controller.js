(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  studio.chatbot = {
    createChatbotController
  };

  function createChatbotController(options = {}) {
    const {
      formatMoney,
      hasSharedToken,
      looksLikeLeadDetails,
      matchesAny,
      normalizeText,
      splitTitleBody
    } = options.core || {};
    const {
      getUrlAttribution,
      syncLeadToCrm,
      trackEvent
    } = options.runtime || {};

    return {
      attachChatbot,
      generateLocalReply,
      extractContact,
      extractName
    };

    function attachChatbot(container) {
      const widget = container.querySelector(".chatbot-widget");

      if (!widget) {
        return;
      }

      const context = readChatbotContext(widget);
      const messages = widget.querySelector("[data-chatbot-messages]");
      const form = widget.querySelector("[data-chatbot-form]");
      const input = form?.elements.message;
      const launcher = widget.querySelector(".chatbot-launcher");
      const history = [];
      const conversationId = global.crypto && typeof global.crypto.randomUUID === "function"
        ? `chat_${global.crypto.randomUUID()}`
        : `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      context.chatbot = context.chatbot || {};
      context.chatbot.conversationId = conversationId;

      const closeChatbot = ({ restoreFocus = true } = {}) => {
        widget.classList.remove("is-open");
        launcher?.setAttribute("aria-expanded", "false");
        if (restoreFocus) {
          launcher?.focus();
        }
      };

      launcher?.addEventListener("click", () => {
        widget.classList.add("is-open");
        launcher.setAttribute("aria-expanded", "true");
        trackEvent("chatbot_open", { business: context.business?.name || "", conversationId });
        input?.focus();
      });

      widget.querySelector(".chatbot-close")?.addEventListener("click", () => {
        closeChatbot();
      });

      widget.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && widget.classList.contains("is-open")) {
          event.preventDefault();
          closeChatbot();
        }
      });

      widget.querySelectorAll("[data-chatbot-prompt]").forEach((button) => {
        button.addEventListener("click", () => {
          trackEvent("chatbot_prompt", { prompt: button.dataset.chatbotPrompt || "", conversationId });
          submitMessage(button.dataset.chatbotPrompt || "", { messages, input, context, history });
        });
      });

      form?.addEventListener("submit", (event) => {
        event.preventDefault();
        submitMessage(input?.value || "", { messages, input, context, history });
      });
    }

    async function submitMessage(rawMessage, state) {
      const message = rawMessage.trim();

      if (!message) {
        return;
      }

      trackEvent("chatbot_message", {
        business: state.context.business?.name || "",
        conversationId: state.context.chatbot?.conversationId || "",
        message,
        contact: extractContact(message)
      });

      addChatMessage(state.messages, message, "user");
      state.history.push({ role: "user", content: message });

      if (state.input) {
        state.input.value = "";
      }

      const loading = addChatMessage(state.messages, "Pensando...", "bot is-loading");

      try {
        const reply = state.context.chatbot.endpoint
          ? await askEndpoint(message, state.context, state.history)
          : generateLocalReply(message, state.context, state.history);

        loading.remove();
        addChatMessage(state.messages, reply, "bot");
        state.history.push({ role: "assistant", content: reply });
      } catch (error) {
        loading.remove();
        const fallback = generateLocalReply(message, state.context, state.history);
        addChatMessage(state.messages, fallback, "bot");
        state.history.push({ role: "assistant", content: fallback });
      }
    }

    function addChatMessage(messages, text, type) {
      const message = document.createElement("div");
      message.className = `chat-message is-${type}`;
      message.textContent = text;
      messages.appendChild(message);
      messages.scrollTop = messages.scrollHeight;
      return message;
    }

    async function askEndpoint(message, context, history) {
      const response = await fetch(context.chatbot.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message,
          history: history.slice(-8),
          business: context.business,
          services: context.services,
          hours: context.hours,
          faqs: context.faqs,
          links: context.links,
          google: context.google,
          tone: context.chatbot.tone
        })
      });

      if (!response.ok) {
        throw new Error("Chatbot endpoint failed");
      }

      const data = await response.json();
      return String(data.reply || data.message || "Ahora mismo no tengo una respuesta clara.");
    }

    function generateLocalReply(message, rawContext, history = []) {
      const context = normalizeContext(rawContext);
      const text = normalizeText(message);
      const business = context.business;
      const contact = buildContactLine(context);
      const lead = extractLeadFromMessage(message, context, history);
      const matchedFaq = context.faqs.find((faq) => hasSharedToken(text, faq.question));

      if (lead) {
        return `Perfecto, he dejado una solicitud preparada para ${business.name}.\n\nResumen:\n- Nombre: ${lead.name}\n- Contacto: ${lead.contact}\n- Necesidad: ${lead.message}\n\n${buildNextStepLine(context)}`;
      }

      if (matchedFaq) {
        return `${matchedFaq.answer}\n\n${buildSoftLeadPrompt(context)}\n\n${contact}`;
      }

      if (matchesAny(text, ["horario", "hora", "abierto", "abrir", "cerrado", "cuando"])) {
        return context.hours.length
          ? `El horario de ${business.name} es:\n${context.hours.map((line) => `- ${line}`).join("\n")}\n\n${buildSoftLeadPrompt(context)}\n\n${contact}`
          : `Todavia no hay horario detallado publicado. ${contact}`;
      }

      if (matchesAny(text, ["reserv", "cita", "mesa", "turno", "agenda", "booking"])) {
        if (looksLikeLeadDetails(text)) {
          const quickLead = storeChatLead({
            business: business.name,
            name: "Lead desde chatbot",
            contact: extractContact(message) || "",
            message,
            source: "chatbot",
            leadEndpoint: context.chatbot?.leadEndpoint || "",
            conversationId: context.chatbot?.conversationId || ""
          });
          return `Perfecto. Hemos recibido los datos de reserva.\n\nResumen recibido: ${quickLead.message}\n\n${buildNextStepLine(context)}\n\n${contact}`;
        }

        return business.bookingUrl && business.bookingUrl !== "#contacto"
          ? `Puedes reservar desde aqui: ${business.bookingUrl}\n\nSi prefieres, dime nombre, dia, hora y telefono para que podamos responderte con disponibilidad.`
          : `Para reservar, dime nombre, dia/hora y telefono. Tambien puedes contactar directamente:\n${contact}`;
      }

      if (matchesAny(text, ["donde", "direccion", "ubicacion", "mapa", "llegar", "localizacion"])) {
        const map = business.mapsLink ? `\nMapa: ${business.mapsLink}` : "";
        const note = context.google?.directionsNote ? `\n${context.google.directionsNote}` : "";
        return `${business.address || business.location || "La direccion aun no esta publicada."}${note}${map}\n\n${contact}`;
      }

      if (context.commerce?.enabled && matchesAny(text, ["tienda", "comprar", "compra", "carrito", "producto", "pago", "precio"])) {
        const products = context.commerce.products || [];
        return products.length
          ? `Puedes comprar desde la seccion Tienda. Productos destacados:\n${products.slice(0, 5).map((item) => `- ${item.name}: ${formatMoney(item.price, context.commerce.currency)}`).join("\n")}\n\nEl pago se abre en Stripe Checkout cuando confirmas el carrito.`
          : "La tienda esta activa, pero todavia no hay productos publicados.";
      }

      if (matchesAny(text, ["servicio", "menu", "carta", "tratamiento", "producto", "precio", "ofrece"])) {
        return context.services.length
          ? `Estos son algunos servicios destacados:\n${context.services.map((item) => `- ${splitTitleBody(item).title}`).join("\n")}\n\n${buildSoftLeadPrompt(context)}\n\n${contact}`
          : `Todavia no hay servicios detallados publicados. ${contact}`;
      }

      if (matchesAny(text, ["telefono", "llamar", "email", "correo", "contacto", "whatsapp"])) {
        return contact;
      }

      if (matchesAny(text, ["instagram", "redes", "tiktok", "facebook", "fotos", "galeria"])) {
        return context.links.length
          ? `Puedes ver mas aqui:\n${context.links.map((link) => `- ${link.label}: ${link.url}`).join("\n")}`
          : "Ahora mismo no hay redes enlazadas, pero puedes usar el contacto principal.";
      }

      if (matchesAny(text, ["resena", "reseña", "opinion", "opiniones", "rating", "valoracion", "valoración"])) {
        const google = context.google || {};
        const rating = google.rating ? `Rating Google: ${google.rating}/5 con ${google.reviewCount || 0} resenas.` : "";
        const reviewUrl = google.reviewUrl ? `\nDejar resena: ${google.reviewUrl}` : "";
        return `${rating || "Todavia no hay rating conectado en esta demo."}${reviewUrl}\n\n${buildSoftLeadPrompt(context)}\n\n${contact}`.trim();
      }

      return buildDefaultReply(context);
    }

    function normalizeContext(context = {}) {
      return {
        ...context,
        business: context.business || { name: "este negocio" },
        chatbot: context.chatbot || {},
        commerce: context.commerce || {},
        google: context.google || {},
        services: Array.isArray(context.services) ? context.services : [],
        hours: Array.isArray(context.hours) ? context.hours : [],
        faqs: Array.isArray(context.faqs) ? context.faqs : [],
        links: Array.isArray(context.links) ? context.links : []
      };
    }

    function buildDefaultReply(context) {
      const business = context.business;
      const options = [
        "horarios",
        business.bookingUrl && business.bookingUrl !== "#contacto" ? "reservas" : "contacto",
        business.address ? "ubicacion" : "",
        context.commerce?.enabled ? "tienda online" : "",
        context.services.length ? "servicios" : "",
        context.faqs.length ? "preguntas frecuentes" : ""
      ].filter(Boolean);

      return `Soy el asistente de ${business.name}. Puedo ayudarte con ${options.join(", ")}.\n\n${buildSoftLeadPrompt(context)}\n\n${buildContactLine(context)}`;
    }

    function buildSoftLeadPrompt(context) {
      return `Si quieres que ${context.business.name} te responda con contexto, escribe: "Me llamo [nombre], mi contacto es [telefono/email] y necesito [detalle]".`;
    }

    function buildNextStepLine(context) {
      const business = context.business;
      return business.bookingUrl && business.bookingUrl !== "#contacto"
        ? `Siguiente paso recomendado: usar ${business.bookingUrl} o esperar respuesta del negocio.`
        : "Siguiente paso recomendado: el negocio puede contactar con esta persona desde el lead guardado.";
    }

    function extractLeadFromMessage(message, context, history) {
      const contact = extractContact(message);
      const name = extractName(message);

      if (!contact || !name || message.length < 18) {
        return null;
      }

      return storeChatLead({
        business: context.business?.name || "",
        name,
        contact,
        message,
        source: "chatbot",
        leadEndpoint: context.chatbot?.leadEndpoint || "",
        conversationId: context.chatbot?.conversationId || "",
        previousIntent: history.slice(-3).map((item) => item.content).join(" | ")
      });
    }

    function storeChatLead(lead) {
      const storedLead = {
        ...lead,
        ...getUrlAttribution(),
        timestamp: new Date().toISOString()
      };
      global.localLiftLeads = global.localLiftLeads || [];
      global.localLiftLeads.push(storedLead);
      syncLeadToCrm(lead.leadEndpoint || "", storedLead).catch(() => {});
      trackEvent("chatbot_lead_captured", {
        business: storedLead.business || "",
        contact: storedLead.contact || "",
        source: storedLead.source || "chatbot",
        conversationId: storedLead.conversationId || ""
      });
      return storedLead;
    }

    function extractContact(message) {
      const email = String(message).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
      const phone = String(message).match(/(\+?\d[\d\s().-]{7,})/)?.[0];
      return email || phone || "";
    }

    function extractName(message) {
      const explicit = String(message).match(/(?:me llamo|soy|nombre es)\s+([a-zA-ZÀ-ÿ\s]{2,40})/i)?.[1];

      if (explicit) {
        return explicit.trim().replace(/\s+(mi|y|con|para).*$/i, "");
      }

      return "Lead desde chatbot";
    }

    function buildContactLine(context) {
      const business = context.business;
      const parts = [];
      const reviewTemplate = context.google?.reviewRequestTemplate;

      if (business.phone) {
        parts.push(`Telefono: ${business.phone}`);
      }

      if (business.email) {
        parts.push(`Email: ${business.email}`);
      }

      if (business.bookingUrl && business.bookingUrl !== "#contacto") {
        parts.push(`${context.chatbot.handoffLabel}: ${business.bookingUrl}`);
      }

      if (reviewTemplate && context.google?.reviewUrl) {
        parts.push(`Pedir resena: ${reviewTemplate.replaceAll("{business}", business.name).replaceAll("{reviewUrl}", context.google.reviewUrl)}`);
      }

      return parts.length ? parts.join("\n") : "Puedes usar el formulario o enlaces de contacto de esta web.";
    }

    function readChatbotContext(widget) {
      try {
        return JSON.parse(widget.dataset.chatbotContext || "{}");
      } catch (error) {
        return {};
      }
    }
  }
})(globalThis);
