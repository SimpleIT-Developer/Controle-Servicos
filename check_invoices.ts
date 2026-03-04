
import { storage } from "./server/storage";

async function check() {
  try {
    console.log("Checking invoices in database...");
    const invoices = await storage.getInvoices();
    console.log(`Found ${invoices.length} invoices.`);
    if (invoices.length > 0) {
      console.log("First invoice:", JSON.stringify(invoices[0], null, 2));
    }
  } catch (error) {
    console.error("Error checking invoices:", error);
  }
  process.exit(0);
}

check();
