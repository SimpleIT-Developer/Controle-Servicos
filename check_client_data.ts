
import { db } from "./server/db";
import { clients, nfseEmissoes } from "./shared/schema";
import { eq, desc } from "drizzle-orm";

async function checkData() {
  try {
    console.log("Checking client 'LEGIAO DA BOA VONTADE'...");
    const allClients = await db.select().from(clients);
    const targetClient = allClients.find(c => c.name.toUpperCase().includes("LEGIAO"));
    
    if (targetClient) {
      console.log("Client found:", targetClient);
    } else {
      console.log("Client not found.");
    }

    console.log("\nChecking latest nfse_emissoes...");
    const latestEmissoes = await db.select().from(nfseEmissoes).orderBy(desc(nfseEmissoes.createdAt)).limit(5);
    
    latestEmissoes.forEach(e => {
      console.log(`ID: ${e.id}, Tomador: ${e.tomadorNome}, Doc: '${e.tomadorCpfCnpj}', Status: ${e.status}`);
    });

  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

checkData();
