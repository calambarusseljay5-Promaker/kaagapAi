import { supabase } from "../lib/supabaseClient";

const FUNCTION_NAME = "send-sms";
const SMS_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

export const normalizeSmsPhone = (value) => {
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

export const isValidSmsPhone = (value) => SMS_PHONE_PATTERN.test(normalizeSmsPhone(value));

export const parseSmsRecipients = (value) => {
  const seen = new Set();
  const recipients = [];
  const invalid = [];

  String(value || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const phone = normalizeSmsPhone(item);

      if (!SMS_PHONE_PATTERN.test(phone)) {
        invalid.push(item);
        return;
      }

      if (!seen.has(phone)) {
        seen.add(phone);
        recipients.push(phone);
      }
    });

  return { recipients, invalid };
};

export async function sendSmsNotification({ to, body }) {
  const recipient = normalizeSmsPhone(to);
  const message = String(body || "").trim();

  if (!recipient) throw new Error("Resident phone number is required.");
  if (!SMS_PHONE_PATTERN.test(recipient)) {
    throw new Error("Use an E.164 phone number, example: +639171234567.");
  }
  if (!message) throw new Error("SMS message is required.");

  let edgeError = null;
  try {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: {
        to: recipient,
        body: message,
      },
    });

    if (!error && !data?.error) {
      return data;
    }
    edgeError = error?.message || data?.error;
  } catch (err) {
    edgeError = err?.message;
  }

  // Fallback: Direct TextBee Gateway API call if Edge Function returned non-2xx status code
  const apiKey = import.meta.env.VITE_TEXTBEE_API_KEY || "309ccc30-acba-4dcc-91bd-341bf2592588";
  const deviceId = import.meta.env.VITE_TEXTBEE_DEVICE_ID || "6a1d3161fdeb151e3594109f";
  const baseUrl = import.meta.env.VITE_TEXTBEE_BASE_URL || "https://api.textbee.dev";

  if (apiKey && deviceId) {
    try {
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
          recipients: [recipient],
          message: message.slice(0, 1500),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok && !result.error) {
        return {
          provider: "textbee-direct",
          status: result.status || "queued",
          to: recipient,
          result,
        };
      }

      const directErr = result?.message || result?.error || "TextBee API returned an error.";
      throw new Error(directErr);
    } catch (directError) {
      throw new Error(directError.message || edgeError || "Unable to send SMS.");
    }
  }

  throw new Error(edgeError || "Unable to send SMS.");
}

export async function sendBulkSmsNotifications({ recipients, body }) {
  const parsed = Array.isArray(recipients)
    ? parseSmsRecipients(recipients.join("\n"))
    : parseSmsRecipients(recipients);
  const message = String(body || "").trim();

  if (parsed.invalid.length > 0) {
    throw new Error(`Invalid phone number(s): ${parsed.invalid.slice(0, 3).join(", ")}`);
  }
  if (parsed.recipients.length === 0) {
    throw new Error("Add at least one resident phone number.");
  }
  if (!message) throw new Error("SMS message is required.");

  const sent = [];
  const failed = [];

  for (const recipient of parsed.recipients) {
    try {
      const result = await sendSmsNotification({ to: recipient, body: message });
      sent.push({ to: recipient, result });
    } catch (error) {
      failed.push({
        to: recipient,
        error: error.message || "Unable to send SMS.",
      });
    }
  }

  return {
    sent,
    failed,
    total: parsed.recipients.length,
  };
}
