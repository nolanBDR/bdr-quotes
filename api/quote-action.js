import { sql, ensureSchema } from "./_db.js";
import { htmlPage } from "./_email.js";

export default async function handler(req, res) {
  const token = req.query?.token;
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!token) {
    res.status(400).send(htmlPage("Invalid link", "<h1>Invalid link</h1><p>No token provided.</p>"));
    return;
  }

  try {
    await ensureSchema();
    const rows = await sql`SELECT * FROM quote_actions WHERE token = ${token}`;
    const action = rows[0];
    if (!action) {
      res.status(404).send(htmlPage("Link not found", "<h1>Link not found</h1><p>This link doesn't match any quote.</p>"));
      return;
    }
    if (action.used_at) {
      res.status(200).send(htmlPage("Already used", "<h1>Already actioned</h1><p>This quote has already been responded to.</p>"));
      return;
    }
    if (new Date(action.expires_at) < new Date()) {
      res.status(410).send(htmlPage("Link expired", "<h1>Link expired</h1><p>This link is no longer valid.</p>"));
      return;
    }

    if (action.action_type === "decline") {
      res.writeHead(302, { Location: `/api/decline-form?token=${token}` });
      res.end();
      return;
    }

    // accept
    await sql`UPDATE quotes SET outcome = 'accepted', updated_at = now() WHERE id = ${action.quote_id}`;
    await sql`UPDATE quote_actions SET used_at = now() WHERE token = ${token}`;
    await sql`UPDATE quote_actions SET used_at = now() WHERE quote_id = ${action.quote_id} AND action_type = 'decline' AND used_at IS NULL`;

    res.status(200).send(htmlPage("Accepted", "<h1>&#10003; Marked as accepted</h1><p>This load has been marked accepted in BDR's history.</p>"));
  } catch (e) {
    console.error("GET /api/quote-action failed", e);
    res.status(500).send(htmlPage("Error", "<h1>Something went wrong</h1><p>Please try again or contact BDR directly.</p>"));
  }
}
