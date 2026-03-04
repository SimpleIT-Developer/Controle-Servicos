
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function main() {
  console.log("Migrating invoices table...");

  try {
    // Make FKs nullable
    await pool.query(`ALTER TABLE invoices ALTER COLUMN company_id DROP NOT NULL;`);
    await pool.query(`ALTER TABLE invoices ALTER COLUMN client_id DROP NOT NULL;`);

    // Add text columns for provider (prestador) and borrower (tomador)
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS provider_name text;`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS provider_doc text;`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS borrower_name text;`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS borrower_doc text;`);

    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await pool.end();
  }
}

main();
