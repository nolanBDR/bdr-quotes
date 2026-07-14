import { neon } from "@neondatabase/serverless";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

// neon() validates the connection string immediately and throws if it's missing —
// calling it at module load time would crash the whole function on import
// (Vercel reports this as a generic FUNCTION_INVOCATION_FAILED, before any
// handler's try/catch gets a chance to run). Building it lazily means a missing
// env var surfaces as a normal, catchable error inside the request handler instead.
let _sql = null;
function getSql() {
  if (!connectionString) {
    throw new Error("Missing POSTGRES_URL/DATABASE_URL env var — set it in the Vercel project's environment variables.");
  }
  if (!_sql) _sql = neon(connectionString);
  return _sql;
}

export const sql = (...args) => getSql()(...args);

let schemaReady = null;

// Idempotent — safe to call on every request. Vercel Postgres/Neon integrations
// don't give us a migration step, so the schema self-creates on first use.
export function ensureSchema() {
  if (!schemaReady) schemaReady = createSchema().catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}

async function createSchema() {
  // Best-effort — some managed Postgres roles can't CREATE EXTENSION. Fuzzy broker
  // matching falls back to plain ILIKE (no trigram index) if this fails.
  try { await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`; } catch (e) { console.warn("pg_trgm unavailable:", e.message); }

  await sql`
    CREATE TABLE IF NOT EXISTS brokers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name text NOT NULL,
      company_name_normalized text NOT NULL,
      primary_contact_name text,
      primary_email text,
      phone text,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  try {
    await sql`CREATE INDEX IF NOT EXISTS brokers_name_trgm_idx ON brokers USING gin (company_name_normalized gin_trgm_ops)`;
  } catch (e) { console.warn("trigram index unavailable:", e.message); }

  await sql`
    CREATE TABLE IF NOT EXISTS quotes (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      client_timestamp bigint NOT NULL,
      broker_id uuid REFERENCES brokers(id),
      outcome text NOT NULL DEFAULT 'waiting'
        CHECK (outcome IN ('waiting','received','lost','broker_sending','declined','counter','sent_load','pending','accepted')),
      date text,
      time text,
      broker_name text,
      broker_company text,
      broker_email text,
      broker_phone text,
      origin text,
      dest_city text,
      dest_state text,
      direction text DEFAULT 'outbound',
      skids numeric,
      weight_lbs numeric,
      base_rate numeric,
      fsc numeric,
      total numeric,
      rate_city text,
      basis_label text,
      charge_skids text,
      quote_text text,
      pickup_date text,
      delivery_date text,
      consignee text,
      delivery_address text,
      commodity text,
      reference_number text,
      counter_offer numeric,
      counter_reply_text text,
      counter_resolved text,
      email_sent_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS quotes_client_timestamp_idx ON quotes (client_timestamp)`;
  await sql`CREATE INDEX IF NOT EXISTS quotes_broker_id_idx ON quotes (broker_id)`;
  await sql`CREATE INDEX IF NOT EXISTS quotes_outcome_idx ON quotes (outcome)`;
  await sql`CREATE INDEX IF NOT EXISTS quotes_created_at_idx ON quotes (created_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS quote_actions (
      token text PRIMARY KEY,
      quote_id bigint NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      action_type text NOT NULL CHECK (action_type IN ('accept','decline')),
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      used_by_ip text
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS quote_actions_quote_id_idx ON quote_actions (quote_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS decline_feedback (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      quote_id bigint NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      feedback_text text,
      counter_rate numeric,
      alternate_dates text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

export function normalizeCompany(s) {
  return (s || "").trim().toLowerCase();
}

// Fuzzy-match a broker by company name (mirrors the client's matchCustomer()
// substring logic), creating a new row if nothing matches. Returns the broker id.
export async function findOrCreateBroker({ company, contactName, email, phone }) {
  const norm = normalizeCompany(company) || normalizeCompany(email);
  if (!norm) return null;

  const existing = await sql`
    SELECT id FROM brokers
    WHERE company_name_normalized = ${norm}
       OR company_name_normalized ILIKE ${"%" + norm + "%"}
       OR ${norm} ILIKE ('%' || company_name_normalized || '%')
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  if (existing.length) {
    await sql`
      UPDATE brokers SET
        primary_email = COALESCE(primary_email, ${email || null}),
        primary_contact_name = COALESCE(primary_contact_name, ${contactName || null}),
        phone = COALESCE(phone, ${phone || null}),
        updated_at = now()
      WHERE id = ${existing[0].id}
    `;
    return existing[0].id;
  }

  const inserted = await sql`
    INSERT INTO brokers (company_name, company_name_normalized, primary_contact_name, primary_email, phone)
    VALUES (${company || email || "Unknown"}, ${norm}, ${contactName || null}, ${email || null}, ${phone || null})
    RETURNING id
  `;
  return inserted[0].id;
}
