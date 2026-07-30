import { sql, ensureSchema, findOrCreateBroker } from "./_db.js";
import { sendEmail } from "./_email.js";

function routeRecipient({ dest_state, direction }) {
  // Temporary test override — set DEV_EMAIL_OVERRIDE in Vercel's env vars to
  // reroute every quote email here instead of the real BDR inboxes. Remove
  // the env var (no code change needed) once ready to go live.
  if (process.env.DEV_EMAIL_OVERRIDE) return process.env.DEV_EMAIL_OVERRIDE;
  if (dest_state === "TX") return "texas@bdrint.ca";
  if ((direction || "outbound") === "inbound") return "inbound@bdrint.ca";
  return "outbound@bdrint.ca";
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "method_not_allowed" }); return; }

  try {
    await ensureSchema();
    const q = req.body || {};
    if (!q.timestamp || !q.broker_email || !q.quote_text) {
      res.status(400).json({ ok: false, error: "missing_fields" });
      return;
    }

    const brokerId = await findOrCreateBroker({
      company: q.broker_company,
      contactName: q.broker_name,
      email: q.broker_email,
      phone: q.broker_phone,
    });

    // A rate table quotes many skid counts at once, not one bookable shipment —
    // stored with basis_label 'rate_table' and no skids/base_rate/total, and no
    // accept/decline tokens (those only make sense for a single quoted price).
    const rows = await sql`
      INSERT INTO quotes (
        client_timestamp, broker_id, outcome, date, time,
        broker_name, broker_company, broker_email, broker_phone,
        origin, dest_city, dest_state, direction,
        basis_label, quote_text
      ) VALUES (
        ${q.timestamp}, ${brokerId}, 'waiting', ${q.date || null}, ${q.time || null},
        ${q.broker_name || null}, ${q.broker_company || null}, ${q.broker_email}, ${q.broker_phone || null},
        ${q.origin || null}, ${q.dest_city || null}, ${q.dest_state || null}, ${q.direction || "outbound"},
        'rate_table', ${q.quote_text}
      )
      ON CONFLICT (client_timestamp) DO UPDATE SET
        broker_email = EXCLUDED.broker_email,
        updated_at = now()
      RETURNING id
    `;
    const quoteId = rows[0].id;

    const to = routeRecipient(q);
    const html = `
      <div style="font-family:Arial,sans-serif;color:#1B232E;max-width:600px;margin:0 auto;">
        <h2 style="color:#641833;margin-bottom:4px;">New Rate Table Request</h2>
        <p style="margin-top:0;color:#5c5f66;">${q.broker_company || "—"} &middot; ${q.origin || "—"} &rarr; ${q.dest_city || "—"}, ${q.dest_state || "—"}${q.skid_count ? ` &middot; ${q.skid_count} skid counts` : ""}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
          <tr><td style="padding:4px 0;color:#5c5f66;">Broker</td><td style="padding:4px 0;font-weight:700;">${q.broker_name || "—"}</td></tr>
          <tr><td style="padding:4px 0;color:#5c5f66;">Company</td><td style="padding:4px 0;font-weight:700;">${q.broker_company || "—"}</td></tr>
          <tr><td style="padding:4px 0;color:#5c5f66;">Email</td><td style="padding:4px 0;font-weight:700;">${q.broker_email}</td></tr>
          <tr><td style="padding:4px 0;color:#5c5f66;">Phone</td><td style="padding:4px 0;font-weight:700;">${q.broker_phone || "—"}</td></tr>
        </table>
        <pre style="white-space:pre-wrap;background:#f7f4ee;border:1px solid #e3dccd;border-radius:6px;padding:12px 14px;font-size:13px;line-height:1.6;">${String(q.quote_text || "").replace(/</g, "&lt;")}</pre>
      </div>
    `;

    const emailResult = await sendEmail({
      to,
      subject: `Rate Table — ${q.broker_company || "Broker"} — ${q.origin || ""} → ${q.dest_city || ""}, ${q.dest_state || ""}`,
      html,
    });

    await sql`UPDATE quotes SET email_sent_at = now() WHERE id = ${quoteId}`;

    res.status(200).json({ ok: true, quoteId, recipient: to, emailResult });
  } catch (e) {
    console.error("POST /api/send-rate-table-email failed", e);
    res.status(500).json({ ok: false, error: "send_failed" });
  }
}
