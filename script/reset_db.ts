
import "dotenv/config";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function resetDb() {
  console.log("Dropping all tables...");
  await db.execute(sql`DROP TABLE IF EXISTS "landlord_transfers" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "cash_transactions" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "services" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "receipts" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "invoices" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "contracts" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "properties" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "guarantors" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "tenants" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "landlords" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "service_providers" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "companies" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "clients" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "analysts" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "service_catalog" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "contract_items" CASCADE`);
  console.log("All tables dropped.");
  process.exit(0);
}

resetDb().catch(console.error);
