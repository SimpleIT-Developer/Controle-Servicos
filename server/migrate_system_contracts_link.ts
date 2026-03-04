
import { db } from "./db";
import { systemContracts, companies, clients } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  console.log("Iniciando migração de Contratos de Sistemas...");

  const contracts = await db.select().from(systemContracts);
  console.log(`Encontrados ${contracts.length} contratos.`);

  let updatedCount = 0;

  for (const contract of contracts) {
    // 1. Vincular Empresa
    const [company] = await db.select().from(companies).where(eq(companies.name, contract.companyName));
    
    // 2. Vincular Cliente
    const [client] = await db.select().from(clients).where(eq(clients.name, contract.clientName));

    if (company || client) {
      await db.update(systemContracts)
        .set({
          companyId: company?.id || null,
          clientId: client?.id || null
        })
        .where(eq(systemContracts.id, contract.id));
      
      updatedCount++;
      console.log(`Contrato ${contract.id} atualizado: Company=${company?.name || 'N/A'}, Client=${client?.name || 'N/A'}`);
    }
  }

  console.log(`Migração concluída. ${updatedCount} contratos atualizados.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
