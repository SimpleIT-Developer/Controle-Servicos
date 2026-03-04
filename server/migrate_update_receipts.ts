
import pg from "pg";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const { Pool } = pg;

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log("Running migration to update receipts table...");
    
    // Add system_contract_id column
    await pool.query(`
      ALTER TABLE receipts 
      ADD COLUMN IF NOT EXISTS system_contract_id varchar REFERENCES system_contracts(id);
    `);
    
    // Add unique index
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS receipts_system_contract_ref_unique 
      ON receipts (system_contract_id, ref_year, ref_month);
    `);

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

runMigration();
