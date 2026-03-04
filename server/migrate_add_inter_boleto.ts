
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log("Migrating companies and receipts tables for Inter Boleto...");

  try {
    // Add columns to companies
    await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS inter_client_id text;`);
    await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS inter_client_secret text;`);
    await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS inter_cert_path text;`);
    await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS inter_environment text DEFAULT 'sandbox';`);

    // Add columns to receipts
    await pool.query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS boleto_solicitacao_id text;`);
    await pool.query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS boleto_status text DEFAULT 'PENDING';`);
    await pool.query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS boleto_pdf_url text;`);

    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await pool.end();
  }
}

main();
