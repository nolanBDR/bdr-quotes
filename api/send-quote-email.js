import crypto from "crypto";
import { sql, ensureSchema, findOrCreateBroker } from "./_db.js";
import { sendEmail, actionButton } from "./_email.js";

const APP_URL = process.env.PUBLIC_APP_URL || "https://bdr-quotes.vercel.app";
const TOKEN_TTL_DAYS = 45;

function routeRecipient({ dest_state, direction }) {
  if (dest_state === "TX") return "texas@bdrint.ca";
  if ((direction || "outbound") === "inbound") return "inbound@bdrint.ca";
  return "outbound@bdrint.ca";
}

function mintToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "method_not_allowed" }); return; }
  await ensureSchema();

  try {
    const q = req.body || {};
    if (!q.timestamp || !q.broker_email) {
      res.status(400).json({ ok: false, error: "missing_fields" });
      return;
    }

    const brokerId = await findOrCreateBroker({
      company: q.broker_company,
      contactName: q.broker_name,
      email: q.broker_email,
      phone: q.broker_phone,
    });

    // Upsert so a quote can be emailed even if the fire-and-forget dual-write
    // from saveQuote() hasn't landed yet.
    const rows = await sql`
      INSERT INTO quotes (
        client_timestamp, broker_id, outcome, date, time,
        broker_name, broker_company, broker_email, broker_phone,
        origin, dest_city, dest_state, direction,
        skids, weight_lbs, base_rate, fsc, total,
        rate_city, basis_label, charge_skids, quote_text
      ) VALUES (
        ${q.timestamp}, ${brokerId}, 'waiting', ${q.date || null}, ${q.time || null},
        ${q.broker_name || null}, ${q.broker_company || null}, ${q.broker_email}, ${q.broker_phone || null},
        ${q.origin || null}, ${q.dest_city || null}, ${q.dest_state || null}, ${q.direction || "outbound"},
        ${q.skids ?? null}, ${q.weight_lbs ?? null}, ${q.base_rate ?? null}, ${q.fsc ?? null}, ${q.total ?? null},
        ${q.rate_city || null}, ${q.basis_label || null}, ${q.charge_skids || null}, ${q.quote_text || null}
      )
      ON CONFLICT (client_timestamp) DO UPDATE SET
        broker_email = EXCLUDED.broker_email,
        updated_at = now()
      RETURNING id
    `;
    const quoteId = rows[0].id;

    const acceptToken = mintToken();
    const declineToken = mintToken();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await sql`
      INSERT INTO quote_actions (token, quote_id, action_type, expires_at) VALUES
      (${acceptToken}, ${quoteId}, 'accept', ${expiresAt}),
      (${declineToken}, ${quoteId}, 'decline', ${expiresAt})
    `;

    const to = routeRecipient(q);
    const acceptUrl = `${APP_URL}/api/quote-action?token=${acceptToken}`;
    const declineUrl = `${APP_URL}/api/quote-action?token=${declineToken}`;

    const html = `
      <div style="font-family:Arial,sans-serif;color:#1B232E;max-width:600px;margin:0 auto;">
        <h2 style="color:#641833;margin-bottom:4px;">New Quote Request</h2>
        <p style="margin-top:0;color:#5c5f66;">${q.broker_company || "—"} &middot; ${q.origin || "—"} &rarr; ${q.dest_city || "—"}, ${q.dest_state || "—"}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
          <tr><td style="padding:4px 0;color:#5c5f66;">Broker</td><td style="padding:4px 0;font-weight:700;">${q.broker_name || "—"}</td></tr>
          <tr><td style="padding:4px 0;color:#5c5f66;">Company</td><td style="padding:4px 0;font-weight:700;">${q.broker_company || "—"}</td></tr>
          <tr><td style="padding:4px 0;color:#5c5f66;">Email</td><td style="padding:4px 0;font-weight:700;">${q.broker_email}</td></tr>
          <tr><td style="padding:4px 0;color:#5c5f66;">Phone</td><td style="padding:4px 0;font-weight:700;">${q.broker_phone || "—"}</td></tr>
          <tr><td style="padding:4px 0;color:#5c5f66;">Skids / Weight</td><td style="padding:4px 0;font-weight:700;">${q.skids ?? "—"} / ${q.weight_lbs ?? "—"} lbs</td></tr>
          <tr><td style="padding:4px 0;color:#5c5f66;">Quoted Total</td><td style="padding:4px 0;font-weight:700;color:#641833;">$${q.total ?? "—"} CAD</td></tr>
        </table>
        <pre style="white-space:pre-wrap;background:#f7f4ee;border:1px solid #e3dccd;border-radius:6px;padding:12px 14px;font-size:13px;line-height:1.6;">${String(q.quote_text || "").replace(/</g, "&lt;")}</pre>
        <div style="margin-top:20px;">
          ${actionButton(acceptUrl, "Accept", "#16a34a")}
          ${actionButton(declineUrl, "Decline", "#641833")}
        </div>
      </div>
    `;

    const emailResult = await sendEmail({
      to,
      subject: `New Quote — ${q.broker_company || "Broker"} — ${q.origin || ""} → ${q.dest_city || ""}, ${q.dest_state || ""} — $${q.total ?? ""} CAD`,
      html,
    });

    await sql`UPDATE quotes SET email_sent_at = now() WHERE id = ${quoteId}`;

    res.status(200).json({ ok: true, quoteId, recipient: to, emailResult });
  } catch (e) {
    console.error("POST /api/send-quote-email failed", e);
    res.status(500).json({ ok: false, error: "send_failed" });
  }
}
