const TERMII_BASE_URL = (
  process.env.TERMII_BASE_URL || "https://api.ng.termii.com"
).replace(/\/+$/, "");

function isTermiiConfigured() {
  return Boolean(
    process.env.TERMII_API_KEY?.trim() &&
      process.env.TERMII_SENDER_ID?.trim(),
  );
}

async function sendTermiiSMS({ to, message }) {
  if (!isTermiiConfigured()) {
    throw new Error(
      "SMS is not configured. Add TERMII_API_KEY and TERMII_SENDER_ID to backend/.env.",
    );
  }

  if (!to || !message) {
    throw new Error("A recipient phone number and message are required.");
  }

  const response = await fetch(`${TERMII_BASE_URL}/api/sms/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TERMII_API_KEY,
      to,
      from: process.env.TERMII_SENDER_ID,
      sms: message,
      type: "plain",
      channel: process.env.TERMII_CHANNEL || "generic",
    }),
    signal: AbortSignal.timeout(20000),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.code === "error") {
    throw new Error(
      data.message || `Termii request failed with HTTP ${response.status}.`,
    );
  }

  if (!data.message_id && !/success/i.test(String(data.message || ""))) {
    throw new Error(data.message || "Termii did not confirm the SMS request.");
  }

  return data;
}

module.exports = { isTermiiConfigured, sendTermiiSMS };
