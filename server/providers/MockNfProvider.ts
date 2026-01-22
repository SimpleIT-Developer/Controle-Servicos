export interface NfEmissionResult {
  success: boolean;
  invoiceId: string | null;
  invoiceNumber: string | null;
  error: string | null;
}

export interface NfProvider {
  emitInvoice(landlordName: string, landlordDoc: string, amount: number, description: string): Promise<NfEmissionResult>;
  getInvoiceStatus(invoiceId: string): Promise<{ status: "pending" | "issued" | "error"; error?: string }>;
}

export class MockNfProvider implements NfProvider {
  private invoiceCounter = 1000;

  async emitInvoice(
    landlordName: string,
    landlordDoc: string,
    amount: number,
    description: string
  ): Promise<NfEmissionResult> {
    console.log(`[MockNF] Invoice emission requested:`, { landlordName, landlordDoc, amount, description });

    await new Promise((resolve) => setTimeout(resolve, 500));

    const success = Math.random() > 0.1;

    if (success) {
      this.invoiceCounter++;
      const invoiceId = `NF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const invoiceNumber = `NF-${this.invoiceCounter}`;
      console.log(`[MockNF] Invoice issued successfully: ${invoiceNumber}`);
      return {
        success: true,
        invoiceId,
        invoiceNumber,
        error: null,
      };
    } else {
      console.log(`[MockNF] Invoice emission failed`);
      return {
        success: false,
        invoiceId: null,
        invoiceNumber: null,
        error: "Falha na comunicação com o ambiente nacional (mock)",
      };
    }
  }

  async getInvoiceStatus(invoiceId: string): Promise<{ status: "pending" | "issued" | "error"; error?: string }> {
    console.log(`[MockNF] Checking status for: ${invoiceId}`);
    return { status: "issued" };
  }
}

export const nfProvider = new MockNfProvider();
