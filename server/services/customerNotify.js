// Customer-facing SMS / WhatsApp notifications (order ready, booking confirmed, etc.)
//
// Provider is chosen via env CUSTOMER_SMS_PROVIDER:
//   'log'    (default) — prints to the server log; works with zero config, ideal
//                        for dev and until a real gateway is wired.
//   'msg91'  — India SMS via MSG91 (env: MSG91_AUTH_KEY, MSG91_SENDER_ID).
//   'twilio' — SMS/WhatsApp via Twilio (env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
//              TWILIO_FROM). Set TWILIO_WHATSAPP=true to send over WhatsApp.
//
// Every send is BEST-EFFORT: failures are logged and swallowed so a notification
// problem can never break order/booking flows.

const PROVIDER = process.env.CUSTOMER_SMS_PROVIDER || 'log';

const sanitizePhone = (p) => (p || '').toString().replace(/[^\d]/g, '');

// India default country code; override with CUSTOMER_SMS_COUNTRY_CODE.
const withCountry = (digits) => {
  const cc = process.env.CUSTOMER_SMS_COUNTRY_CODE || '91';
  return digits.length === 10 ? `${cc}${digits}` : digits;
};

async function sendViaMsg91(phone, message) {
  const key = process.env.MSG91_AUTH_KEY;
  const sender = process.env.MSG91_SENDER_ID || 'CAFEOS';
  if (!key) throw new Error('MSG91_AUTH_KEY is not set');
  const res = await fetch('https://api.msg91.com/api/v2/sendsms', {
    method: 'POST',
    headers: { authkey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender,
      route: '4',
      country: process.env.CUSTOMER_SMS_COUNTRY_CODE || '91',
      sms: [{ message, to: [withCountry(phone)] }],
    }),
  });
  if (!res.ok) throw new Error(`MSG91 responded ${res.status}`);
}

async function sendViaTwilio(phone, message) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) throw new Error('Twilio env (SID/TOKEN/FROM) is not set');
  const wa = process.env.TWILIO_WHATSAPP === 'true';
  const to = `${wa ? 'whatsapp:' : ''}+${withCountry(phone)}`;
  const body = new URLSearchParams({ From: wa ? `whatsapp:${from}` : from, To: to, Body: message });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) throw new Error(`Twilio responded ${res.status}`);
}

/**
 * Send a customer notification. Best-effort: never throws.
 * @returns {Promise<boolean>} true if dispatched (or logged), false otherwise.
 */
async function notifyCustomer(phone, message, meta = {}) {
  const digits = sanitizePhone(phone);
  if (!digits || digits.length < 10 || !message) return false;
  try {
    switch (PROVIDER) {
      case 'log':
        console.log(`[customerNotify:${meta.type || 'sms'}] -> ${digits.replace(/\d(?=\d{4})/g, '*')}`);
        return true;
      case 'msg91':
        await sendViaMsg91(digits, message);
        return true;
      case 'twilio':
        await sendViaTwilio(digits, message);
        return true;
      default:
        console.warn(`[customerNotify] unknown provider "${PROVIDER}"; message not sent`);
        return false;
    }
  } catch (err) {
    console.error('[customerNotify] send failed:', err.message);
    return false;
  }
}

module.exports = { notifyCustomer };
