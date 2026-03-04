import "dotenv/config";
import { db } from "./server/db";
import { nfseConfigs } from "./shared/schema";
import { eq } from "drizzle-orm";

async function check() {
  console.log("Checking NFSe Configs...");
  const companyId = "f2cdcbd4-aa36-48d0-87d3-bc0e896f60af";
  
  try {
    const [config] = await db.select().from(nfseConfigs).where(eq(nfseConfigs.companyId, companyId));
    
    if (!config) {
        console.log("No config found for company.");
        process.exit(0);
    }

    console.log(`Certificado Length: ${config.certificado?.length || 0}`);
    console.log(`Certificado Start: ${config.certificado ? config.certificado.substring(0, 50) : 'NULL'}`);
    
    if (config.certificado) {
        // Try to decode base64
        const buf = Buffer.from(config.certificado, 'base64');
        console.log(`Decoded Buffer Length: ${buf.length}`);
        console.log(`First bytes: ${buf.subarray(0, 20).toString('hex')}`);
    }

  } catch (err) {
      console.error("Error:", err);
  }
  process.exit(0);
}

check();
