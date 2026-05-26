import { createServer } from "node:http";

const port = Number(process.env.PORT || 8787);
const host = "127.0.0.1";
const model = process.env.OPENAI_MODEL || "gpt-5-mini";
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn("Missing OPENAI_API_KEY. The server will return setup guidance.");
}

const server = createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/chat") {
    sendJson(response, 404, { error: "Use POST /api/chat" });
    return;
  }

  try {
    const payload = await readJson(request);

    if (!apiKey) {
      sendJson(response, 200, {
        reply:
          "El asistente IA aun no tiene OPENAI_API_KEY configurada en el servidor. Mientras tanto, el widget puede responder con el modo local."
      });
      return;
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        instructions: buildInstructions(payload),
        input: buildInput(payload)
      })
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      sendJson(response, 502, { error: "OpenAI request failed", detail: errorText });
      return;
    }

    const data = await openaiResponse.json();
    sendJson(response, 200, { reply: data.output_text || extractOutputText(data) });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Unexpected chatbot error" });
  }
});

server.listen(port, host, () => {
  console.log(`Chatbot API example running at http://${host}:${port}/api/chat`);
});

function buildInstructions(payload) {
  const business = payload.business || {};
  return [
    `Eres el asistente de atencion al cliente de ${business.name || "un negocio local"}.`,
    "Responde en espanol, con frases cortas y utiles.",
    "Usa solamente los datos del negocio que recibes en el contexto.",
    "Si no sabes algo, dilo claramente y ofrece contacto humano.",
    "No inventes precios, disponibilidad ni politicas.",
    `Tono deseado: ${payload.tone || "cercano"}.`
  ].join("\n");
}

function buildInput(payload) {
  return JSON.stringify(
    {
      question: payload.message,
      recent_history: payload.history || [],
      business: payload.business || {},
      services: payload.services || [],
      hours: payload.hours || [],
      faqs: payload.faqs || [],
      links: payload.links || []
    },
    null,
    2
  );
}

function extractOutputText(data) {
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .map((part) => part.text || "")
    .join("\n")
    .trim();
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

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
