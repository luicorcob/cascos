(function (global) {
  const COMPATIBLE_CATEGORIES = [
    "restaurant", "restaurante", "bar", "cafe", "cafeteria", "peluqueria", "hairdresser",
    "clinic", "clinica", "dentist", "dentista", "workshop", "taller", "store", "tienda",
    "gym", "gimnasio", "hotel", "real_estate", "inmobiliaria"
  ];

  function calculateOpportunityScore(business = {}) {
    let score = 0;
    const status = normalizeStatus(business.websiteStatus);
    const reviews = Math.max(0, Number(business.reviews || business.userRatingCount || 0));
    const rating = Math.max(0, Number(business.rating || 0));
    const category = normalize(business.categoryKey || business.category);

    if (status === "none" || status === "social") score += 40;
    if (business.phone) score += 15;
    if (reviews >= 35) score += 10;
    else if (reviews >= 10) score += 6;
    if (rating > 4) score += 10;
    if (COMPATIBLE_CATEGORIES.some((value) => category.includes(value))) score += 15;
    if (String(business.address || "").trim().length >= 8) score += 5;
    if (status === "none" && !business.socialUrl && !business.alternativeUrl) score += 5;

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  function getOpportunityLevel(score) {
    const value = Number(score || 0);
    if (value >= 80) return { key: "hot", label: "Oportunidad caliente" };
    if (value >= 60) return { key: "interesting", label: "Muy interesante" };
    if (value >= 40) return { key: "potential", label: "Potencial" };
    return { key: "low", label: "Baja prioridad" };
  }

  function getScoreReasons(business = {}) {
    const reasons = [];
    const status = normalizeStatus(business.websiteStatus);
    const reviews = Number(business.reviews || 0);

    if (status === "none" && business.websiteEvidence === "not_declared") reasons.push("Web no declarada en la fuente");
    else if (status === "none") reasons.push("La ficha no muestra web propia");
    else if (status === "social") reasons.push("Depende solo de redes sociales");
    if (business.phone) reasons.push("Contacto directo disponible");
    if (Number(business.rating || 0) > 4) reasons.push(`Valoración ${Number(business.rating).toFixed(1)}`);
    if (reviews >= 35) reasons.push(`${reviews} reseñas: demanda validada`);
    if (business.address) reasons.push("Ubicación comercial clara");
    return reasons.slice(0, 3);
  }

  function normalizeStatus(value) {
    const status = normalize(value);
    if (["none", "no_web", "sin web", "sin-web"].includes(status)) return "none";
    if (["website", "has_web", "tiene web", "web"].includes(status)) return "website";
    if (["social", "social_only", "solo redes", "redes"].includes(status)) return "social";
    return "unverified";
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  global.DLSRadarScore = {
    calculateOpportunityScore,
    getOpportunityLevel,
    getScoreReasons,
    normalizeStatus
  };
})(globalThis);
