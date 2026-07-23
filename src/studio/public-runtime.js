(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  studio.publicRuntime = {
    createPublicRuntime
  };

  function createPublicRuntime(options = {}) {
    const {
      apiUrl = (path) => path,
      getCurrentBusinessRecord = () => null,
      slugify,
      textOr,
      toDatetimeLocalValue
    } = options;

    return {
      attachLeadForms,
      attachPublicBookingForms,
      attachTracking,
      trackEvent,
      getUrlAttribution,
      getPublicLeadEndpoint,
      getPublicBookingEndpoint,
      getPublicEventEndpoint,
      syncLeadToCrm,
      syncBookingToAgenda,
      syncEventToMetrics
    };

    function attachLeadForms(container, business) {
      container.querySelectorAll("[data-lead-form]").forEach((leadForm) => {
        leadForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          const data = new FormData(leadForm);
          const lead = {
            business: business.name,
            name: textOr(data.get("leadName"), "Lead sin nombre"),
            contact: textOr(data.get("leadContact"), ""),
            message: textOr(data.get("leadMessage"), ""),
            privacyAccepted: data.get("privacyAccepted") === "true",
            privacyAcceptedAt: new Date().toISOString(),
            privacyPolicyUrl: business.privacyUrl || "",
            source: "form",
            ...getUrlAttribution(),
            timestamp: new Date().toISOString()
          };

          global.localLiftLeads = global.localLiftLeads || [];
          global.localLiftLeads.push(lead);
          trackEvent("lead_form_submit", {
            business: business.name,
            contact: lead.contact,
            source: lead.source
          });
          const status = leadForm.querySelector("[data-lead-status]");

          try {
            await syncLeadToCrm(leadForm.dataset.leadEndpoint || getPublicLeadEndpoint(business), lead);
            if (status) {
              status.textContent = "Lead guardado en el CRM.";
            }
          } catch (error) {
            if (status) {
              status.textContent = "Lead guardado en esta sesion. La API CRM no esta disponible.";
            }
          }

          leadForm.reset();
        });
      });
    }

    function attachPublicBookingForms(container, business) {
      container.querySelectorAll("[data-public-booking-form]").forEach((bookingForm) => {
        const startsAt = bookingForm.elements.startsAt;

        if (startsAt && !startsAt.min) {
          startsAt.min = toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
        }

        bookingForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          const data = new FormData(bookingForm);
          const booking = {
            business: business.name,
            serviceName: textOr(data.get("serviceName"), "Reserva"),
            customerName: textOr(data.get("customerName"), "Cliente sin nombre"),
            contact: textOr(data.get("contact"), ""),
            startsAt: data.get("startsAt") ? new Date(String(data.get("startsAt"))).toISOString() : "",
            notes: textOr(data.get("notes"), ""),
            privacyAccepted: data.get("privacyAccepted") === "true",
            privacyAcceptedAt: new Date().toISOString(),
            privacyPolicyUrl: business.privacyUrl || "",
            source: "public-widget",
            ...getUrlAttribution(),
            timestamp: new Date().toISOString()
          };
          const status = bookingForm.querySelector("[data-booking-status]");

          global.localLiftBookings = global.localLiftBookings || [];
          global.localLiftBookings.push(booking);
          trackEvent("public_booking_submit", {
            business: business.name,
            service: booking.serviceName,
            contact: booking.contact,
            source: booking.source
          });

          try {
            await syncBookingToAgenda(
              bookingForm.dataset.bookingEndpoint || getPublicBookingEndpoint(business),
              booking
            );
            if (status) {
              status.textContent = "Reserva enviada a la agenda. El negocio confirmara el hueco.";
            }
          } catch (error) {
            if (status) {
              status.textContent = error.status === 409
                ? "Ese hueco no esta disponible. Prueba otra hora."
                : "Reserva guardada en esta sesion. La agenda no esta disponible.";
            }
          }

          bookingForm.reset();

          if (startsAt) {
            startsAt.min = toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
          }
        });
      });
    }

    function attachTracking(container, business) {
      container.querySelectorAll("[data-track]").forEach((element) => {
        element.addEventListener("click", () => {
          trackEvent(element.dataset.track, {
            business: business.name,
            category: business.category
          });
        });
      });
    }

    function trackEvent(name, detail = {}) {
      global.localLiftEvents = global.localLiftEvents || [];
      const attribution = getUrlAttribution();
      const eventDetail = { ...detail, ...attribution };
      const event = {
        name,
        detail: eventDetail,
        ...attribution,
        timestamp: new Date().toISOString()
      };
      global.localLiftEvents.push(event);
      global.dataLayer?.push({ event: `locallift_${name}`, ...eventDetail });
      syncEventToMetrics(getPublicEventEndpoint(), {
        ...event,
        page: global.location?.pathname || "",
        referrer: global.document?.referrer || "",
        userAgent: global.navigator?.userAgent || ""
      }).catch(() => {});
    }

    function getUrlAttribution() {
      const params = new URLSearchParams(global.location?.search || "");
      const fields = [
        ["utmSource", "utm_source", 120],
        ["utmMedium", "utm_medium", 120],
        ["utmCampaign", "utm_campaign", 240]
      ];

      return Object.fromEntries(fields
        .map(([key, queryKey, maxLength]) => [
          key,
          String(params.get(queryKey) || "").replace(/\s+/g, " ").trim().slice(0, maxLength)
        ])
        .filter(([, value]) => value));
    }

    function getPublicLeadEndpoint(business = {}) {
      const identifier = getBusinessIdentifier(business);
      return identifier ? apiUrl(`/api/public/${encodeURIComponent(identifier)}/leads`) : "";
    }

    function getPublicBookingEndpoint(business = {}) {
      const identifier = getBusinessIdentifier(business);
      return identifier ? apiUrl(`/api/public/${encodeURIComponent(identifier)}/bookings`) : "";
    }

    function getPublicEventEndpoint(business = {}) {
      const identifier = getBusinessIdentifier(business);
      return identifier ? apiUrl(`/api/public/${encodeURIComponent(identifier)}/events`) : "";
    }

    function getBusinessIdentifier(business = {}) {
      const record = getCurrentBusinessRecord();
      return record?.slug
        || record?.id
        || business.slug
        || business.id
        || slugify(business.name || "");
    }

    async function syncLeadToCrm(endpoint, lead) {
      if (!endpoint) {
        return null;
      }

      const response = await fetch(apiUrl(endpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ lead })
      });

      if (!response.ok) {
        throw new Error("Lead CRM request failed");
      }

      return response.json();
    }

    async function syncBookingToAgenda(endpoint, booking) {
      if (!endpoint) {
        return null;
      }

      const response = await fetch(apiUrl(endpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ booking })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const error = new Error("Booking API request failed");
        error.status = response.status;
        error.apiMessage = payload.error || "";
        throw error;
      }

      return response.json();
    }

    async function syncEventToMetrics(endpoint, event) {
      if (!endpoint) {
        return null;
      }

      const response = await fetch(apiUrl(endpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ event })
      });

      if (!response.ok) {
        throw new Error("Event API request failed");
      }

      return response.json();
    }
  }
})(globalThis);
