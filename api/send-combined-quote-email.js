import crypto from "crypto";
import { sql, ensureSchema, findOrCreateBroker } from "./_db.js";
import { sendEmail, actionButton } from "./_email.js";

const APP_URL = process.env.PUBLIC_APP_URL || "https://bdr-quotes.vercel.app";
const TOKEN_TTL_DAYS = 45;

function routeRecipient({ dest_state, direction }) {
  if (process.env.DEV_EMAIL_OVERRIDE) return process.env.DEV_EMAIL_OVERRIDE;
  if (dest_state === "TX") return "texas@bdrint.ca";
  if ((direction || "outbound") === "inbound") return "inbound@bdrint.ca";
  return "outbound@bdrint.ca";
}

function mintToken() {
  return crypto.randomBytes(32).toString("base64url");
}

// Saves one shipment's quote row + mints its own accept/decline tokens — same
// per-quote logic as /api/send-quote-email, just callable per item here since
// a combined email still needs each shipment to be individually acceptable.
async function saveQuoteAndMintTokens(q, brokerId) {
  const rows = await sql`
    INSERT INTO quotes (
      client_timestamp, broker_id, outcome, date, time,
      broker_name, broker_company, broker_email, broker_phone,
      origin, dest_city, dest_state, direction,
      skids, weight_lbs, base_rate, fsc, total,
      rate_city, basis_label, charge_skids, quote_text,
      zone_tier, zone_pct, zone_miles, zone_source
    ) VALUES (
      ${q.timestamp}, ${brokerId}, 'waiting', ${q.date || null}, ${q.time || null},
      ${q.broker_name || null}, ${q.broker_company || null}, ${q.broker_email}, ${q.broker_phone || null},
      ${q.origin || null}, ${q.dest_city || null}, ${q.dest_state || null}, ${q.direction || "outbound"},
      ${q.skids ?? null}, ${q.weight_lbs ?? null}, ${q.base_rate ?? null}, ${q.fsc ?? null}, ${q.total ?? null},
      ${q.rate_city || null}, ${q.basis_label || null}, ${q.charge_skids || null}, ${q.quote_text || null},
      ${q.zone_tier || null}, ${q.zone_pct ?? null}, ${q.zone_miles ?? null}, ${q.zone_source || null}
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
  return {
    quoteId,
    acceptUrl: `${APP_URL}/api/quote-action?token=${acceptToken}`,
    declineUrl: `${APP_URL}/api/quote-action?token=${declineToken}`,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "method_not_allowed" }); return; }

  try {
    await ensureSchema();
    const { quotes } = req.body || {};
    if (!Array.isArray(quotes) || quotes.length === 0) {
      res.status(400).json({ ok: false, error: "missing_quotes" });
      return;
    }
    const first = quotes[0];
    if (!first?.broker_email) {
      res.status(400).json({ ok: false, error: "missing_broker_email" });
      return;
    }

    const brokerId = await findOrCreateBroker({
      company: first.broker_company,
      contactName: first.broker_name,
      email: first.broker_email,
      phone: first.broker_phone,
    });

    // A batch pasted from one email is nearly always the same direction, but
    // group by actual recipient anyway (e.g. a Texas destination mixed into an
    // otherwise-outbound batch) so nothing silently goes to the wrong inbox —
    // each group becomes its own combined email.
    const groups = new Map(); // recipient -> [{q, acceptUrl, declineUrl}]
    for (const q of quotes) {
      if (!q.timestamp || !q.quote_text) continue;
      const { acceptUrl, declineUrl } = await saveQuoteAndMintTokens(q, brokerId);
      const to = routeRecipient(q);
      if (!groups.has(to)) groups.set(to, []);
      groups.get(to).push({ q, acceptUrl, declineUrl });
    }
    if (groups.size === 0) {
      res.status(400).json({ ok: false, error: "no_valid_quotes" });
      return;
    }

    const results = [];
    for (const [to, items] of groups) {
      const totalSum = items.reduce((sum, { q }) => sum + (q.total || 0), 0);
      const sections = items.map(({ q, acceptUrl, declineUrl }) => `
        <div style="margin:20px 0;padding:16px 18px;background:#f7f4ee;border:1px solid #e3dccd;border-radius:8px;">
          <div style="font-weight:700;color:#641833;margin-bottom:6px;">${q.origin || "—"} &rarr; ${q.dest_city || "—"}, ${q.dest_state || "—"} &mdash; $${q.total ?? "—"} CAD</div>
          <pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;margin:8px 0;color:#1B232E;">${String(q.quote_text || "").replace(/</g, "&lt;")}</pre>
          <div style="margin-top:10px;">
            ${actionButton(acceptUrl, "Accept", "#16a34a")}
            ${actionButton(declineUrl, "Decline", "#641833")}
          </div>
        </div>`).join("");

      const html = `
        <div style="font-family:Arial,sans-serif;color:#1B232E;max-width:640px;margin:0 auto;">
          <h2 style="color:#641833;margin-bottom:4px;">New Quotes — ${items.length} Shipment${items.length===1?"":"s"}</h2>
          <p style="margin-top:0;color:#5c5f66;">${first.broker_company || "—"} &middot; ${first.broker_name || "—"} &middot; ${first.broker_email}</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0;">
            <tr><td style="padding:4px 0;color:#5c5f66;">Combined Total</td><td style="padding:4px 0;font-weight:700;color:#641833;">$${totalSum} CAD</td></tr>
          </table>
          ${sections}
        </div>`;

      const emailResult = await sendEmail({
        to,
        subject: `New Quotes — ${first.broker_company || "Broker"} — ${items.length} shipment${items.length===1?"":"s"} — $${totalSum} CAD`,
        html,
      });
      for (const { q } of items) {
        await sql`UPDATE quotes SET email_sent_at = now() WHERE client_timestamp = ${q.timestamp}`;
      }
      results.push({ to, count: items.length, timestamps: items.map(({ q }) => q.timestamp), emailResult });
    }

    res.status(200).json({ ok: true, results });
  } catch (e) {
    console.error("POST /api/send-combined-quote-email failed", e);
    res.status(500).json({ ok: false, error: "send_failed" });
  }
}
