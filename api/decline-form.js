import { sql, ensureSchema } from "./_db.js";
import { htmlPage, htmlFormPage } from "./_email.js";

export default async function handler(req, res) {
  await ensureSchema();
  const token = req.query?.token;
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!token) {
    res.status(400).send(htmlPage("Invalid link", "<h1>Invalid link</h1>"));
    return;
  }

  try {
    const rows = await sql`
      SELECT qa.*, q.broker_name, q.broker_company, q.origin, q.dest_city, q.dest_state, q.total, q.quote_text
      FROM quote_actions qa JOIN quotes q ON q.id = qa.quote_id
      WHERE qa.token = ${token}
    `;
    const row = rows[0];
    if (!row || row.action_type !== "decline") {
      res.status(404).send(htmlPage("Link not found", "<h1>Link not found</h1>"));
      return;
    }
    if (row.used_at) {
      res.status(200).send(htmlPage("Already used", "<h1>Already actioned</h1><p>This quote has already been responded to.</p>"));
      return;
    }
    if (new Date(row.expires_at) < new Date()) {
      res.status(410).send(htmlPage("Link expired", "<h1>Link expired</h1>"));
      return;
    }

    const body = `
      <h1>Decline / Counter — ${row.broker_company || row.broker_name || "Broker"}</h1>
      <div class="meta">${row.origin || "—"} &rarr; ${row.dest_city || "—"}, ${row.dest_state || "—"} &middot; Quoted $${row.total ?? "—"} CAD</div>
      <form method="POST" action="/api/counter-response">
        <input type="hidden" name="token" value="${token}">
        <label>Feedback to broker</label>
        <textarea name="feedback_text" placeholder="e.g. We can't service this lane at this rate right now..."></textarea>
        <label>Counter rate (optional)</label>
        <input type="number" step="1" name="counter_rate" placeholder="e.g. 950">
        <label>Alternate delivery date(s) (optional)</label>
        <input type="text" name="alternate_dates" placeholder="e.g. July 16 or 17">
        <button type="submit">Send to Broker</button>
      </form>
    `;
    res.status(200).send(htmlFormPage("Decline / Counter", body));
  } catch (e) {
    console.error("GET /api/decline-form failed", e);
    res.status(500).send(htmlPage("Error", "<h1>Something went wrong</h1>"));
  }
}
