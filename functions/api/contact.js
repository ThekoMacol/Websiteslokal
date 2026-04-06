export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': new URL(request.url).origin,
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Content-Type-Options': 'nosniff',
  };

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültige Anfrage.' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // Honeypot (Spam-Schutz)
  if (body.website) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const { name, business, email, message } = body;

  if (!name?.trim())    return err('Name ist erforderlich.', corsHeaders);
  if (!email?.trim())   return err('E-Mail ist erforderlich.', corsHeaders);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return err('Ungültige E-Mail-Adresse.', corsHeaders);
  if (!message?.trim()) return err('Nachricht ist erforderlich.', corsHeaders);

  const RESEND_API_KEY  = env.RESEND_API_KEY;
  const CONTACT_TO_EMAIL = env.CONTACT_TO_EMAIL || 'kornelius.thelen@log1k.de';

  if (!RESEND_API_KEY || !CONTACT_TO_EMAIL) {
    return new Response(JSON.stringify({ error: 'Serverkonfigurationsfehler.' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const timestamp = new Date().toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const businessRow = business?.trim()
    ? `<tr>
        <td style="padding:10px 16px;background:#1a1a1a;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;width:120px;white-space:nowrap;">Unternehmen</td>
        <td style="padding:10px 16px;background:#111;font-size:15px;color:#e8e8e8;border-left:1px solid #2a2a2a;">${escapeHtml(business.trim())}</td>
      </tr>`
    : '';

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:sans-serif;">
  <table cellpadding="0" cellspacing="0" style="width:100%;background:#0a0a0a;">
    <tr><td style="padding:32px 16px;">
      <table cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#111;border-radius:8px;border:1px solid #2a2a2a;">
        <tr><td colspan="2" style="padding:24px;background:#1a1a1a;border-bottom:1px solid #2a2a2a;text-align:center;">
          <h1 style="margin:0;font-size:20px;color:#f0f0f0;">Neue Anfrage</h1>
        </td></tr>
        <tr>
          <td style="padding:10px 16px;background:#1a1a1a;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;width:120px;white-space:nowrap;">Name</td>
          <td style="padding:10px 16px;background:#111;font-size:15px;color:#e8e8e8;border-left:1px solid #2a2a2a;">${escapeHtml(name.trim())}</td>
        </tr>
        ${businessRow}
        <tr>
          <td style="padding:10px 16px;background:#1a1a1a;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;width:120px;white-space:nowrap;">E-Mail</td>
          <td style="padding:10px 16px;background:#111;font-size:15px;border-left:1px solid #2a2a2a;"><a href="mailto:${escapeHtml(email.trim())}" style="color:#e8642a;">${escapeHtml(email.trim())}</a></td>
        </tr>
        <tr>
          <td style="padding:10px 16px;background:#1a1a1a;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;width:120px;vertical-align:top;white-space:nowrap;">Nachricht</td>
          <td style="padding:10px 16px;background:#111;font-size:15px;color:#e8e8e8;border-left:1px solid #2a2a2a;white-space:pre-wrap;line-height:1.6;">${escapeHtml(message.trim())}</td>
        </tr>
        <tr><td colspan="2" style="padding:14px 16px;background:#0d0d0d;border-top:1px solid #2a2a2a;text-align:right;">
          <span style="font-size:12px;color:#555;">${timestamp} Uhr</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Kontakt <noreply@webseite-hagen.de>',
        to: [CONTACT_TO_EMAIL],
        reply_to: email.trim(),
        subject: 'Neue Anfrage - webseite-hagen.de',
        html,
      }),
    });
    if (!res.ok) throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: 'Senden fehlgeschlagen. Bitte später erneut versuchen.' }), {
      status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': new URL(context.request.url).origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST')    return onRequestPost(context);
  if (context.request.method === 'OPTIONS') return onRequestOptions(context);
  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
}

function err(msg, headers) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 422, headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
