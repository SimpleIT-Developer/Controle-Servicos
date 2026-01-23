export interface NfEmissionResult {
  success: boolean;
  invoiceId: string | null;
  invoiceNumber: string | null;
  error: string | null;
}

export interface NfCancellationResult {
  success: boolean;
  error: string | null;
}

export interface NfProvider {
  emitInvoice(landlordName: string, landlordDoc: string, amount: number, description: string): Promise<NfEmissionResult>;
  cancelInvoice(invoiceId: string, reason: string): Promise<NfCancellationResult>;
  getInvoiceStatus(invoiceId: string): Promise<{ status: "pending" | "issued" | "error" | "cancelled"; error?: string }>;
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

  async cancelInvoice(invoiceId: string, reason: string): Promise<NfCancellationResult> {
    console.log(`[MockNF] Invoice cancellation requested:`, { invoiceId, reason });
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { success: true, error: null };
  }

  async getInvoiceStatus(invoiceId: string): Promise<{ status: "pending" | "issued" | "error" | "cancelled"; error?: string }> {
    console.log(`[MockNF] Checking status for: ${invoiceId}`);
    return { status: "issued" };
  }
}

export const nfProvider = new MockNfProvider();
