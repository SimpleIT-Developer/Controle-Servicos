
import { db } from "./server/db";
import { nfseConfigs, companies } from "./shared/schema";
import { eq } from "drizzle-orm";

async function checkConfigs() {
  try {
    console.log("Checking NFS-e Configs...");
    const configs = await db.select().from(nfseConfigs);
    
    for (const config of configs) {
      const company = await db.select().from(companies).where(eq(companies.id, config.companyId || "")).limit(1);
      const companyName = company[0]?.name || "Unknown";
      
      const certLength = config.certificado ? config.certificado.length : 0;
      const isBase64 = certLength > 500;
      
      console.log(`Company: ${companyName}`);
      console.log(`  Certificado Length: ${certLength}`);
      console.log(`  Is Base64 (likely): ${isBase64}`);
      console.log(`  Start of Cert: ${config.certificado ? config.certificado.substring(0, 50) : "N/A"}...`);
    }

  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

checkConfigs();
