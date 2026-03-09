import { sql } from '@vercel/postgres';

let tablesInitialized = false;

export async function ensureTablesExist() {
  if (tablesInitialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      date_time TIMESTAMPTZ NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'confirmed'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL,
      CONSTRAINT single_row CHECK (id = 1)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS blocked_dates (
      date_string TEXT PRIMARY KEY
    )
  `;

  tablesInitialized = true;
}

export { sql };
