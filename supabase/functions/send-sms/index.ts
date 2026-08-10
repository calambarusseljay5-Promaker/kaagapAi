const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const normalizePhone = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const compact = raw.replace(/[\s().-]/g, "");
  if (compact.startsWith("+")) return compact;

  const digits = compact.replace(/\D/g, "");
  if (digits.startsWith("09") && digits.length === 11) return `+63${digits.slice(1)}`;
  if (digits.startsWith("9") && digits.length === 10) return `+63${digits}`;
  if (digits.startsWith("639") && digits.length === 12) return `+${digits}`;

  return raw;
};

const readJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const apiKey = Deno.env.get("TEXTBEE_API_KEY");
  const deviceId = Deno.env.get("TEXTBEE_DEVICE_ID");
  const baseUrl = Deno.env.get("TEXTBEE_BASE_URL") || "https://api.textbee.dev";

  if (!apiKey || !deviceId) {
    return jsonResponse(
      {
        error:
          "TextBee is not configured. Add TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID to Supabase secrets.",
      },
      500
    );
  }

  let payload: { to?: unknown; body?: unknown };

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request body." }, 400);
  }

  const to = normalizePhone(payload.to);
  const body = String(payload.body || "").trim();

  if (!/^\+[1-9]\d{7,14}$/.test(to)) {
    return jsonResponse({ error: "Use an E.164 phone number, example: +639171234567." }, 400);
  }

  if (!body) {
    return jsonResponse({ error: "SMS message is required." }, 400);
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/v1/gateway/devices/${encodeURIComponent(
    deviceId
  )}/send-sms`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      recipients: [to],
      message: body.slice(0, 1500),
    }),
  });

  const result = await readJson(response);

  if (!response.ok) {
    return jsonResponse(
      {
        error:
          String(result?.message || result?.error || "") ||
          "TextBee was unable to send the SMS.",
        code: result?.code || null,
      },
      response.status
    );
  }

  return jsonResponse({
    provider: "textbee",
    status: result.status || "queued",
    to,
    result,
  });
});
