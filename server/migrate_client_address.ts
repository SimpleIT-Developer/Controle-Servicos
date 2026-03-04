
import "dotenv/config";
import { db } from "./db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Migrating clients table to add address fields...");

  try {
    await db.execute(sql`
      ALTER TABLE clients 
      ADD COLUMN IF NOT EXISTS street text,
      ADD COLUMN IF NOT EXISTS number text,
      ADD COLUMN IF NOT EXISTS complement text,
      ADD COLUMN IF NOT EXISTS neighborhood text;
    `);

    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
  }

  process.exit(0);
}

main();
