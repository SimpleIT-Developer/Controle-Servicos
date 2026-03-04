
import { db } from "./server/db";
import { invoices, nfseEmissoes } from "./shared/schema";
import { eq, or } from "drizzle-orm";

async function checkStuckInvoices() {
  console.log("Checking for stuck invoices...");
  
  const stuckEmissoes = await db.select().from(nfseEmissoes).where(
    or(
      eq(nfseEmissoes.status, "ENVIANDO"),
      eq(nfseEmissoes.status, "PROCESSANDO")
    )
  );

  console.log(`Found ${stuckEmissoes.length} stuck emissions.`);
  
  for (const emissao of stuckEmissoes) {
    console.log(`- ID: ${emissao.id}, Status: ${emissao.status}, CreatedAt: ${emissao.createdAt}`);
  }

  if (stuckEmissoes.length === 0) {
      // List all to see what statuses exist
      const all = await db.select().from(nfseEmissoes);
      console.log("All emissions status distribution:");
      const distribution = all.reduce((acc, curr) => {
          acc[curr.status] = (acc[curr.status] || 0) + 1;
          return acc;
      }, {} as Record<string, number>);
      console.log(distribution);
  }
}

checkStuckInvoices().catch(console.error).finally(() => process.exit());
