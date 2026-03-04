
import pg from "pg";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file
dotenv.config();

const { Pool } = pg;

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log("Running migration to create system_contracts table...");
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_contracts (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name text NOT NULL,
        client_name text NOT NULL,
        system_name text NOT NULL DEFAULT 'SimpleDFe',
        monthly_value decimal(10, 2) NOT NULL,
        start_date date NOT NULL,
        end_date date,
        active boolean DEFAULT true NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
    
    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

runMigration();
