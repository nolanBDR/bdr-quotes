import { sql, ensureSchema } from "./_db.js";
import { sendEmail, htmlPage } from "./_email.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).send("Method not allowed"); return; }
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  try {
    await ensureSchema();
    const { token, feedback_text, counter_rate, alternate_dates } = req.body || {};
    if (!token) {
      res.status(400).send(htmlPage("Invalid submission", "<h1>Invalid submission</h1>"));
      return;
    }

    const rows = await sql`
      SELECT qa.*, q.broker_email, q.broker_name, q.broker_company, q.origin, q.dest_city, q.dest_state
      FROM quote_actions qa JOIN quotes q ON q.id = qa.quote_id
      WHERE qa.token = ${token}
    `;
    const row = rows[0];
    if (!row || row.action_type !== "decline") {
      res.status(404).send(htmlPage("Link not found", "<h1>Link not found</h1>"));
      return;
    }
    if (row.used_at) {
      res.status(200).send(htmlPage("Already used", "<h1>Already submitted</h1>"));
      return;
    }
    if (new Date(row.expires_at) < new Date()) {
      res.status(410).send(htmlPage("Link expired", "<h1>Link expired</h1>"));
      return;
    }

    const counterRateNum = counter_rate ? Number(counter_rate) : null;

    await sql`
      INSERT INTO decline_feedback (quote_id, feedback_text, counter_rate, alternate_dates)
      VALUES (${row.quote_id}, ${feedback_text || null}, ${counterRateNum}, ${alternate_dates || null})
    `;
    await sql`UPDATE quotes SET outcome = 'declined', updated_at = now() WHERE id = ${row.quote_id}`;
    await sql`UPDATE quote_actions SET used_at = now() WHERE token = ${token}`;
    await sql`UPDATE quote_actions SET used_at = now() WHERE quote_id = ${row.quote_id} AND action_type = 'accept' AND used_at IS NULL`;

    if (row.broker_email) {
      const html = `
        <div style="font-family:Arial,sans-serif;color:#1B232E;max-width:600px;margin:0 auto;">
          <h2 style="color:#641833;">Update on your quote request</h2>
          <p>${row.origin || "—"} &rarr; ${row.dest_city || "—"}, ${row.dest_state || "—"}</p>
          ${feedback_text ? `<p>${String(feedback_text).replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>` : ""}
          ${counterRateNum ? `<p><strong>Counter rate:</strong> $${counterRateNum} CAD</p>` : ""}
          ${alternate_dates ? `<p><strong>Alternate delivery date(s):</strong> ${String(alternate_dates).replace(/</g, "&lt;")}</p>` : ""}
          <p style="margin-top:20px;color:#5c5f66;">— BDR International Ltd.</p>
        </div>
      `;
      await sendEmail({
        to: row.broker_email,
        subject: `Re: Your quote request — ${row.origin || ""} → ${row.dest_city || ""}, ${row.dest_state || ""}`,
        html,
      });
    }

    res.status(200).send(htmlPage("Sent", "<h1>&#10003; Feedback sent to broker</h1><p>The broker has been emailed with your response.</p>"));
  } catch (e) {
    console.error("POST /api/counter-response failed", e);
    res.status(500).send(htmlPage("Error", "<h1>Something went wrong</h1>"));
  }
}
