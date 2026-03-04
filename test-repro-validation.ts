
import { insertCompanySchema } from "./shared/schema";
import { z } from "zod";

async function test() {
  console.log("Testing insertCompanySchema with form default values...");

  // Simulate what the form sends when only Name and CNPJ are filled
  // The other fields are empty strings based on defaultValues in companies.tsx
  const formData = {
    name: "Minha Empresa Ltda",
    tradeName: "",
    doc: "12.345.678/0001-90",
    address: "",
    phone: "",
    email: "", // Empty string
    city: "",
    state: "",
    zipCode: "",
    bank: "",
    branch: "",
    account: "",
    pixKeyType: undefined, // Default value in form
    pixKey: "",
  };

  try {
    const result = insertCompanySchema.parse(formData);
    console.log("Validation SUCCESS:", result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      console.log("Validation FAILED:");
      console.log(JSON.stringify(e.errors, null, 2));
    } else {
      console.log("Unknown error:", e);
    }
  }

  // Test case 2: pixKeyType as empty string (if user selected and cleared, though Select doesn't support clear easily)
  console.log("\nTesting with pixKeyType = ''");
  const formData2 = { ...formData, pixKeyType: "" };
  try {
    insertCompanySchema.parse(formData2);
    console.log("Validation SUCCESS for pixKeyType=''");
  } catch (e) {
    if (e instanceof z.ZodError) console.log("FAILED:", JSON.stringify(e.errors, null, 2));
  }
}

test();
