import { sql, ensureSchema } from "./_db.js";

export default async function handler(req, res) {
  await ensureSchema();

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  try {
    const rows = await sql`
      SELECT
        b.id, b.company_name, b.primary_contact_name, b.primary_email, b.phone, b.notes,
        COUNT(q.id)::int AS quote_count,
        COUNT(q.id) FILTER (WHERE q.outcome IN ('accepted','received'))::int AS won_count,
        COALESCE(SUM(q.total) FILTER (WHERE q.outcome IN ('accepted','received')), 0)::numeric AS lifetime_revenue,
        MAX(q.created_at) AS last_quote_at
      FROM brokers b
      LEFT JOIN quotes q ON q.broker_id = b.id
      GROUP BY b.id
      ORDER BY last_quote_at DESC NULLS LAST
    `;
    res.status(200).json({ ok: true, brokers: rows });
  } catch (e) {
    console.error("GET /api/brokers failed", e);
    res.status(500).json({ ok: false, error: "fetch_failed" });
  }
}
