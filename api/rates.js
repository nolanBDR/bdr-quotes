import { sql, ensureSchema } from "./_db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  try {
    await ensureSchema();
    const rows = await sql`
      SELECT direction, origin_region, anchor_city, anchor_state, anchor_lat, anchor_lon, base_rates
      FROM rate_lanes
    `;
    res.status(200).json({ ok: true, lanes: rows });
  } catch (e) {
    console.error("GET /api/rates failed", e);
    res.status(500).json({ ok: false, error: "fetch_failed" });
  }
}
