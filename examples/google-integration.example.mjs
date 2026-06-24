import { createServer } from "node:http";

const host = "127.0.0.1";
const port = Number(process.env.PORT || 8790);
const placesApiKey = process.env.GOOGLE_MAPS_API_KEY;
const calendarAccessToken = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
const businessProfileAccessToken = process.env.GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN;
const workspaceAdminAccessToken = process.env.GOOGLE_WORKSPACE_ADMIN_ACCESS_TOKEN;
const defaultCalendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

const server = createServer(async (request, response) => {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    const url = new URL(request.url || "/", `http://${host}:${port}`);

    if (request.method === "GET" && url.pathname === "/api/google/place") {
      await handlePlace(url, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/google/availability") {
      await handleAvailability(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/google/book") {
      await handleBooking(request, response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/google/business/accounts") {
      await handleBusinessAccounts(response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/google/business/locations") {
      await handleBusinessLocations(url, response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/google/reviews") {
      await handleReviews(url, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/google/reviews/reply") {
      await handleReviewReply(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/google/workspace/user") {
      await handleWorkspaceUser(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/google/review-request") {
      await handleReviewRequest(request, response);
      return;
    }

    sendJson(response, 404, {
      error:
        "Use /api/google/place, /api/google/availability, /api/google/book, /api/google/business/accounts, /api/google/business/locations, /api/google/reviews, /api/google/reviews/reply, /api/google/workspace/user or /api/google/review-request"
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Unexpected Google integration error" });
  }
});

server.listen(port, host, () => {
  console.log(`Google integration example running at http://${host}:${port}`);
});

async function handlePlace(url, response) {
  if (!placesApiKey) {
    sendJson(response, 200, {
      setup_required: true,
      message: "Set GOOGLE_MAPS_API_KEY to call Places API."
    });
    return;
  }

  const placeId = url.searchParams.get("placeId");

  if (!placeId) {
    sendJson(response, 400, { error: "Missing placeId" });
    return;
  }

  const fields = [
    "id",
    "displayName",
    "formattedAddress",
    "internationalPhoneNumber",
    "nationalPhoneNumber",
    "websiteUri",
    "googleMapsUri",
    "rating",
    "userRatingCount",
    "regularOpeningHours",
    "photos"
  ].join(",");

  const googleResponse = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": placesApiKey,
      "X-Goog-FieldMask": fields
    }
  });

  if (!googleResponse.ok) {
    sendJson(response, googleResponse.status, { error: await googleResponse.text() });
    return;
  }

  const place = await googleResponse.json();
  sendJson(response, 200, normalizePlace(place));
}

async function handleAvailability(request, response) {
  const payload = await readJson(request);
  const token = payload.accessToken || calendarAccessToken;

  if (!token) {
    sendJson(response, 200, {
      setup_required: true,
      message: "Set GOOGLE_CALENDAR_ACCESS_TOKEN or send accessToken in request body."
    });
    return;
  }

  const calendarId = payload.calendarId || defaultCalendarId;
  const body = {
    timeMin: payload.timeMin,
    timeMax: payload.timeMax,
    timeZone: payload.timeZone || "Europe/Madrid",
    items: [{ id: calendarId }]
  };

  const googleResponse = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!googleResponse.ok) {
    sendJson(response, googleResponse.status, { error: await googleResponse.text() });
    return;
  }

  sendJson(response, 200, await googleResponse.json());
}

async function handleBooking(request, response) {
  const payload = await readJson(request);
  const token = payload.accessToken || calendarAccessToken;

  if (!token) {
    sendJson(response, 200, {
      setup_required: true,
      message: "Set GOOGLE_CALENDAR_ACCESS_TOKEN or send accessToken in request body."
    });
    return;
  }

  const calendarId = encodeURIComponent(payload.calendarId || defaultCalendarId);
  const event = {
    summary: payload.summary || `Reserva DLS - ${payload.customerName || "Cliente"}`,
    description: [
      "Reserva creada desde DLS.",
      payload.service ? `Servicio: ${payload.service}` : "",
      payload.customerName ? `Cliente: ${payload.customerName}` : "",
      payload.phone ? `Telefono: ${payload.phone}` : "",
      payload.email ? `Email: ${payload.email}` : "",
      payload.notes ? `Notas: ${payload.notes}` : ""
    ].filter(Boolean).join("\n"),
    start: {
      dateTime: payload.start,
      timeZone: payload.timeZone || "Europe/Madrid"
    },
    end: {
      dateTime: payload.end,
      timeZone: payload.timeZone || "Europe/Madrid"
    },
    attendees: payload.email ? [{ email: payload.email }] : undefined,
    extendedProperties: {
      private: {
        source: "dls",
        leadId: payload.leadId || ""
      }
    }
  };

  const googleResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(event)
  });

  if (!googleResponse.ok) {
    sendJson(response, googleResponse.status, { error: await googleResponse.text() });
    return;
  }

  sendJson(response, 200, await googleResponse.json());
}

async function handleBusinessAccounts(response) {
  const token = requireBusinessProfileToken(response);
  if (!token) return;

  const data = await googleJson("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", token, response);
  if (data) sendJson(response, 200, data);
}

async function handleBusinessLocations(url, response) {
  const token = requireBusinessProfileToken(response);
  if (!token) return;

  const accountId = url.searchParams.get("accountId");
  if (!accountId) {
    sendJson(response, 400, { error: "Missing accountId" });
    return;
  }

  const readMask = [
    "name",
    "title",
    "storefrontAddress",
    "phoneNumbers",
    "websiteUri",
    "regularHours",
    "metadata",
    "profile"
  ].join(",");
  const endpoint =
    `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${encodeURIComponent(accountId)}/locations?readMask=${encodeURIComponent(readMask)}`;
  const data = await googleJson(endpoint, token, response);
  if (data) sendJson(response, 200, data);
}

async function handleReviews(url, response) {
  const token = requireBusinessProfileToken(response);
  if (!token) return;

  const accountId = url.searchParams.get("accountId");
  const locationId = url.searchParams.get("locationId");

  if (!accountId || !locationId) {
    sendJson(response, 400, { error: "Missing accountId or locationId" });
    return;
  }

  const endpoint =
    `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}/reviews`;
  const data = await googleJson(endpoint, token, response);
  if (data) sendJson(response, 200, data);
}

async function handleReviewReply(request, response) {
  const token = requireBusinessProfileToken(response);
  if (!token) return;

  const payload = await readJson(request);
  const { accountId, locationId, reviewId, comment, dryRun = false } = payload;

  if (!accountId || !locationId || !reviewId || !comment) {
    sendJson(response, 400, { error: "Missing accountId, locationId, reviewId or comment" });
    return;
  }

  if (dryRun) {
    sendJson(response, 200, {
      dryRun: true,
      message: "Review reply validated but not published.",
      reply: { comment }
    });
    return;
  }

  const endpoint =
    `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}/reviews/${encodeURIComponent(reviewId)}/reply`;
  const googleResponse = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ comment })
  });

  if (!googleResponse.ok) {
    sendJson(response, googleResponse.status, { error: await googleResponse.text() });
    return;
  }

  sendJson(response, 200, await googleResponse.json());
}

async function handleWorkspaceUser(request, response) {
  const token = workspaceAdminAccessToken;
  const payload = await readJson(request);
  const { primaryEmail, givenName, familyName, password, dryRun = true } = payload;

  if (!token) {
    sendJson(response, 200, {
      setup_required: true,
      message:
        "Set GOOGLE_WORKSPACE_ADMIN_ACCESS_TOKEN. Creating professional email requires Google Workspace admin rights for the client's domain.",
      requestedUser: { primaryEmail, givenName, familyName },
      dryRun: true
    });
    return;
  }

  if (!primaryEmail || !givenName || !familyName || !password) {
    sendJson(response, 400, { error: "Missing primaryEmail, givenName, familyName or password" });
    return;
  }

  const user = {
    primaryEmail,
    name: {
      givenName,
      familyName
    },
    password,
    changePasswordAtNextLogin: true
  };

  if (dryRun) {
    sendJson(response, 200, {
      dryRun: true,
      message: "Workspace user payload validated but not created.",
      user: { primaryEmail, name: user.name, changePasswordAtNextLogin: true }
    });
    return;
  }

  const googleResponse = await fetch("https://admin.googleapis.com/admin/directory/v1/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(user)
  });

  if (!googleResponse.ok) {
    sendJson(response, googleResponse.status, { error: await googleResponse.text() });
    return;
  }

  sendJson(response, 200, await googleResponse.json());
}

async function handleReviewRequest(request, response) {
  const payload = await readJson(request);
  const business = payload.business || "el negocio";
  const reviewUrl = payload.reviewUrl || "";
  const customerName = payload.customerName || "";
  const channel = payload.channel || "whatsapp";
  const template =
    payload.template ||
    "Gracias por visitar {business}. Tu opinion nos ayuda a mejorar. Puedes dejar una resena aqui: {reviewUrl}";

  const message = template
    .replaceAll("{business}", business)
    .replaceAll("{reviewUrl}", reviewUrl)
    .replaceAll("{customerName}", customerName);

  sendJson(response, 200, {
    channel,
    business,
    customerName,
    reviewUrl,
    message,
    note: "Send this message through WhatsApp, Gmail API, CRM or an approved messaging provider. Do not spam customers."
  });
}

function normalizePlace(place) {
  return {
    placeId: place.id || "",
    name: place.displayName?.text || "",
    address: place.formattedAddress || "",
    phone: place.internationalPhoneNumber || place.nationalPhoneNumber || "",
    websiteUri: place.websiteUri || "",
    mapsUrl: place.googleMapsUri || "",
    rating: place.rating || 0,
    reviewCount: place.userRatingCount || 0,
    hours: place.regularOpeningHours?.weekdayDescriptions || [],
    photoNames: (place.photos || []).map((photo) => photo.name).slice(0, 10)
  };
}

function requireBusinessProfileToken(response) {
  if (!businessProfileAccessToken) {
    sendJson(response, 200, {
      setup_required: true,
      message:
        "Set GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN after the client grants OAuth access to their Business Profile."
    });
    return "";
  }

  return businessProfileAccessToken;
}

async function googleJson(endpoint, token, response) {
  const googleResponse = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!googleResponse.ok) {
    sendJson(response, googleResponse.status, { error: await googleResponse.text() });
    return null;
  }

  return await googleResponse.json();
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function setCors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
