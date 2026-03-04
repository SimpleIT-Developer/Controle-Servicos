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
  console.log("Adding email_status to invoices table...");

  try {
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email_status text DEFAULT 'PENDING';`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email_sent_at timestamp;`);
    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await pool.end();
  }
}

main();
