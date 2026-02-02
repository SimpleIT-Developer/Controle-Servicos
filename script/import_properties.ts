
import 'dotenv/config';
import fs from 'fs';
import { createRequire } from 'module';
import { db } from '../server/db';
import { properties } from '../shared/schema';
import { eq } from 'drizzle-orm';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const pdfPath = 'd:\\Imob_Simple\\Cadastros\\Imóveis\\CADASTRO IMOVEIS.prn.pdf';

async function importProperties() {
  try {
    if (!fs.existsSync(pdfPath)) {
      console.error(`Arquivo não encontrado: ${pdfPath}`);
      process.exit(1);
    }

    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);
    const text = data.text;

    // Split by "Aluguel/Venda:"
    // The first element is before the first property
    const blocks = text.split(/Aluguel\/Venda:\s+/);
    
    // Remove the first block (header)
    blocks.shift();

    console.log(`Encontrados ${blocks.length} imóveis potenciais.`);

    let count = 0;
    let skipped = 0;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      // Normalize spaces to single space for easier regex, but keep newlines for line-based extraction if needed
      // However, the previous script used a flat replace. Let's try to keep some structure or just flat it.
      // Flattening is usually easier if we use delimiters.
      const cleanBlock = block.replace(/\s+/g, ' ').trim();

      // Extract fields
      // Format: "A Endereco: ... Bairro: ... Cidade..: ... Uf: ... CEP: ..."
      
      const typeMatch = cleanBlock.match(/^([AV])/);
      const saleRentCode = typeMatch ? typeMatch[1] : null;
      const saleRent = saleRentCode === 'A' ? 'Aluguel' : (saleRentCode === 'V' ? 'Venda' : 'Aluguel');

      const extract = (label: string, nextLabel?: string) => {
        let regexStr = '';
        if (nextLabel) {
           regexStr = `${label}:\\s*(.*?)\\s*${nextLabel}:`;
        } else {
           regexStr = `${label}:\\s*(.*)`;
        }
        const regex = new RegExp(regexStr, 'i'); // Case insensitive just in case
        const match = cleanBlock.match(regex);
        return match ? match[1].trim() : null;
      };

      // Endereco: ... Bairro:
      const address = extract('Endereco', 'Bairro');
      
      // Bairro: ... Cidade..:
      // Note: "Cidade..:" has dots.
      // In regex, dots need escaping if we match literally, but here we construct string.
      // The text has "Cidade..:".
      const neighborhood = extract('Bairro', 'Cidade\\.\\.');
      
      // Cidade..: ... Uf:
      const city = extract('Cidade\\.\\.', 'Uf');
      
      // Uf: ... CEP:
      const state = extract('Uf', 'CEP');
      
      // CEP: ... (Next field is usually Dependencias or end of line in our flat string)
      // "CEP: 18270-280 Dependencias.:"
      const zipCodeRaw = extract('CEP', 'Dependencias\\.');
      const zipCode = zipCodeRaw || extract('CEP'); // Fallback if Dependencias not found (last item?)

      // Generate a code since it's missing in PDF
      // We'll use a sequential prefix or just a number.
      // Let's use "IMP-" + index + timestamp to ensure uniqueness and allow re-runs (though we should check duplicates)
      // Actually, to avoid duplicates on re-runs, we should probably generate a deterministic code if possible?
      // But we don't have a unique key in the data.
      // Address is a good candidate for uniqueness check.
      
      if (!address) {
          console.log(`Bloco ${i} sem endereço, pulando.`);
          continue;
      }

      // Check if property with this address already exists
      const existing = await db.select().from(properties).where(eq(properties.address, address));
      
      if (existing.length === 0) {
        // Generate code
        // Simple numeric code might be better for user, but we need to ensure it doesn't conflict.
        // Let's generate a random 6 digit code or use date.
        // User's existing codes were "0024".
        // Let's try to parse a number from the start? No.
        // I will generate "AUTO-" + i
        const code = `AUTO-${Date.now().toString().slice(-6)}-${i}`;
        
        await db.insert(properties).values({
           code,
           title: address, // Use address as title
           saleRent,
           address,
           neighborhood,
           city: city || 'TATUI', // Default to Tatui if missing (common in this dataset)
           state: state || 'SP',
           zipCode,
           rentDefault: "0.00", // Not in PDF
           status: 'available',
           landlordId: null // Not in PDF
        });
        count++;
        // console.log(`Importado: ${address}`);
      } else {
        console.log(`Imóvel já existe: ${address}`);
        skipped++;
      }
    }

    console.log(`Importação concluída.`);
    console.log(`Inseridos: ${count}`);
    console.log(`Ignorados (já existentes): ${skipped}`);
    process.exit(0);

  } catch (error) {
    console.error("Erro na importação:", error);
    process.exit(1);
  }
}

importProperties();
