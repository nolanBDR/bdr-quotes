import { sql, ensureSchema, findOrCreateBroker } from "./_db.js";

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      await ensureSchema();
      const q = req.body || {};
      if (!q.timestamp) {
        res.status(400).json({ ok: false, error: "missing_timestamp" });
        return;
      }
      const brokerId = await findOrCreateBroker({
        company: q.broker_company,
        contactName: q.broker_name,
        email: q.broker_email,
        phone: q.broker_phone,
      });

      const rows = await sql`
        INSERT INTO quotes (
          client_timestamp, broker_id, outcome, date, time,
          broker_name, broker_company, broker_email, broker_phone,
          origin, dest_city, dest_state, direction,
          skids, weight_lbs, base_rate, fsc, total,
          rate_city, basis_label, charge_skids, quote_text,
          pickup_date, delivery_date, consignee, delivery_address, commodity, reference_number
        ) VALUES (
          ${q.timestamp}, ${brokerId}, ${q.outcome || "waiting"}, ${q.date || null}, ${q.time || null},
          ${q.broker_name || null}, ${q.broker_company || null}, ${q.broker_email || null}, ${q.broker_phone || null},
          ${q.origin || null}, ${q.dest_city || null}, ${q.dest_state || null}, ${q.direction || "outbound"},
          ${q.skids ?? null}, ${q.weight_lbs ?? null}, ${q.base_rate ?? null}, ${q.fsc ?? null}, ${q.total ?? null},
          ${q.rate_city || null}, ${q.basis_label || null}, ${q.charge_skids || null}, ${q.quote_text || null},
          ${q.pickup_date || null}, ${q.delivery_date || null}, ${q.consignee || null}, ${q.delivery_address || null},
          ${q.commodity || null}, ${q.reference_number || null}
        )
        ON CONFLICT (client_timestamp) DO UPDATE SET
          outcome = EXCLUDED.outcome,
          updated_at = now()
        RETURNING id
      `;
      res.status(200).json({ ok: true, id: rows[0].id, brokerId });
    } catch (e) {
      console.error("POST /api/quotes failed", e);
      res.status(500).json({ ok: false, error: "save_failed" });
    }
    return;
  }

  if (req.method === "GET") {
    try {
      await ensureSchema();
      const { since, brokerId } = req.query || {};
      let rows;
      if (brokerId) {
        rows = await sql`SELECT * FROM quotes WHERE broker_id = ${brokerId} ORDER BY created_at DESC LIMIT 500`;
      } else if (since) {
        rows = await sql`SELECT * FROM quotes WHERE client_timestamp > ${Number(since)} ORDER BY created_at DESC LIMIT 1000`;
      } else {
        rows = await sql`SELECT * FROM quotes ORDER BY created_at DESC LIMIT 500`;
      }
      res.status(200).json({ ok: true, quotes: rows });
    } catch (e) {
      console.error("GET /api/quotes failed", e);
      res.status(500).json({ ok: false, error: "fetch_failed" });
    }
    return;
  }

  if (req.method === "DELETE") {
    try {
      await ensureSchema();
      const { timestamp } = req.query || {};
      if (!timestamp) {
        res.status(400).json({ ok: false, error: "missing_timestamp" });
        return;
      }
      await sql`DELETE FROM quotes WHERE client_timestamp = ${Number(timestamp)}`;
      res.status(200).json({ ok: true });
    } catch (e) {
      console.error("DELETE /api/quotes failed", e);
      res.status(500).json({ ok: false, error: "delete_failed" });
    }
    return;
  }

  res.status(405).json({ ok: false, error: "method_not_allowed" });
}
