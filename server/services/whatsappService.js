// Official WhatsApp Business Cloud API (Meta / Graph API) client.
//
// This is the DIRECT Meta integration (no Twilio / BSP middleman). Business-
// initiated messages to customers outside the 24h service window MUST use a
// pre-approved message template — that is a hard rule of the platform, so the
// broadcast + automation features here are all template-based.
//
// Required env (set on the SERVER / API deployment only, never the client):
//   WHATSAPP_TOKEN                 — permanent access token (System User token)
//   WHATSAPP_PHONE_NUMBER_ID       — the sending phone number's ID
//   WHATSAPP_BUSINESS_ACCOUNT_ID   — WABA id (needed to list templates)
// Optional:
//   WHATSAPP_API_VERSION           — Graph API version   (default 'v21.0')
//   WHATSAPP_COUNTRY_CODE          — default dial code    (default '91' — India)
//   WHATSAPP_WEBHOOK_VERIFY_TOKEN  — echoed back during webhook subscription
//   WHATSAPP_APP_SECRET            — verifies X-Hub-Signature-256 on webhooks

const crypto = require('crypto');

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

const token = () => process.env.WHATSAPP_TOKEN || '';
const phoneNumberId = () => process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const wabaId = () => process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
const countryCode = () => (process.env.WHATSAPP_COUNTRY_CODE || '91').replace(/\D/g, '');

// True only when the three essentials are present. Everything user-facing checks
// this first and shows a setup card instead of trying (and failing) to send.
const isConfigured = () => Boolean(token() && phoneNumberId());

// 10 digits -> country-prefixed E.164 without the leading '+', which is what the
// Cloud API's `to` field expects (e.g. 9876543210 -> 919876543210).
const toE164 = (raw) => {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 10) return `${countryCode()}${d}`;
  return d; // already includes a country code
};

async function graph(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Meta returns { error: { message, code, error_data: { details } } }
    const msg = data?.error?.error_data?.details || data?.error?.message || `Graph API responded ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.metaCode = data?.error?.code;
    throw err;
  }
  return data;
}

// Basic account status for the setup banner. Never throws — returns a flag.
async function getStatus() {
  if (!isConfigured()) {
    return { configured: false, missing: missingEnv() };
  }
  try {
    const d = await graph(`${phoneNumberId()}?fields=display_phone_number,verified_name,quality_rating`);
    return {
      configured: true,
      displayPhoneNumber: d.display_phone_number || null,
      verifiedName: d.verified_name || null,
      qualityRating: d.quality_rating || null,
    };
  } catch (err) {
    return { configured: true, reachable: false, error: err.message };
  }
}

const missingEnv = () => {
  const m = [];
  if (!token()) m.push('WHATSAPP_TOKEN');
  if (!phoneNumberId()) m.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!wabaId()) m.push('WHATSAPP_BUSINESS_ACCOUNT_ID');
  return m;
};

// Approved templates the business can actually send. We surface the body text and
// how many {{n}} variables each one needs so the UI can collect them.
async function listTemplates() {
  if (!wabaId()) throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID is not set');
  const d = await graph(`${wabaId()}/message_templates?fields=name,status,language,category,components&limit=200`);
  const items = (d.data || []).map((t) => {
    const bodyComp = (t.components || []).find((c) => c.type === 'BODY');
    const bodyText = bodyComp?.text || '';
    const varCount = (bodyText.match(/\{\{\s*\d+\s*\}\}/g) || []).length;
    const headerComp = (t.components || []).find((c) => c.type === 'HEADER');
    return {
      name: t.name,
      language: t.language,
      status: t.status,          // APPROVED | PENDING | REJECTED
      category: t.category,      // MARKETING | UTILITY | AUTHENTICATION
      bodyText,
      varCount,
      headerFormat: headerComp?.format || null,
    };
  });
  return items;
}

// Send one template message. `variables` is an ordered array of strings that fill
// {{1}}, {{2}}, … in the template body. Returns the message id (wamid) on success.
async function sendTemplate({ to, template, language = 'en', variables = [] }) {
  if (!isConfigured()) throw new Error('WhatsApp is not configured');
  const dest = toE164(to);
  if (!dest || dest.length < 10) throw new Error('Invalid recipient phone number');

  const components = [];
  if (variables.length) {
    components.push({
      type: 'body',
      parameters: variables.map((v) => ({ type: 'text', text: String(v ?? '') })),
    });
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: dest,
    type: 'template',
    template: {
      name: template,
      language: { code: language },
      ...(components.length ? { components } : {}),
    },
  };
  const d = await graph(`${phoneNumberId()}/messages`, { method: 'POST', body: payload });
  return { wamid: d.messages?.[0]?.id || null };
}

// Plain text — only valid inside the 24h customer-service window (i.e. a reply to
// someone who just messaged us). Used by the webhook auto opt-out acknowledgement.
async function sendText({ to, body }) {
  if (!isConfigured()) throw new Error('WhatsApp is not configured');
  const dest = toE164(to);
  const payload = { messaging_product: 'whatsapp', to: dest, type: 'text', text: { body } };
  const d = await graph(`${phoneNumberId()}/messages`, { method: 'POST', body: payload });
  return { wamid: d.messages?.[0]?.id || null };
}

// Optional webhook payload authenticity check (Meta signs with the app secret).
// Returns true when unsigned verification is disabled (no app secret configured),
// so a missing secret doesn't silently drop every event.
function verifySignature(rawBody, signatureHeader) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;
  if (!signatureHeader || !rawBody) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  isConfigured,
  getStatus,
  missingEnv,
  listTemplates,
  sendTemplate,
  sendText,
  verifySignature,
  toE164,
};
