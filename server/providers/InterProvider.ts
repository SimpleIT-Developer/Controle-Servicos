
import axios from "axios";
import https from "https";
import fs from "fs";

export class InterProvider {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private certPath: string;
  private keyPath?: string;
  private certPass?: string;

  constructor(config: {
    environment: string;
    clientId: string;
    clientSecret: string;
    certPath: string;
    keyPath?: string;
    certPass?: string;
  }) {
    this.baseUrl = config.environment === 'production' 
      ? "https://cdpj.partners.bancointer.com.br"
      : "https://cdpj-sandbox.partners.uatinter.co";
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.certPath = config.certPath;
    this.keyPath = config.keyPath;
    this.certPass = config.certPass;
  }

  private getAgent() {
    if (!this.certPath || !fs.existsSync(this.certPath)) {
      throw new Error(`Certificate not found at ${this.certPath}`);
    }

    // Check if we have a separate key file
    if (this.keyPath) {
        if (!fs.existsSync(this.keyPath)) {
            throw new Error(`Private key not found at ${this.keyPath}`);
        }
        
        console.log("InterProvider: Using CRT/KEY authentication");
        const cert = fs.readFileSync(this.certPath);
        const key = fs.readFileSync(this.keyPath);
        
        return new https.Agent({
            cert: cert,
            key: key,
            passphrase: this.certPass,
            rejectUnauthorized: false
        });
    }

    // Fallback to PFX behavior
    // Sanity check: if certPath ends in .crt, we shouldn't be here (implies missing key)
    if (this.certPath.endsWith('.crt') || this.certPath.endsWith('.pem')) {
        console.warn("InterProvider: Warning - .crt/.pem file provided without .key file. This will likely fail if trying to load as PFX.");
    }

    console.log("InterProvider: Using PFX authentication");
    const cert = fs.readFileSync(this.certPath);
    
    return new https.Agent({
      pfx: cert,
      passphrase: this.certPass,
      rejectUnauthorized: false // Often needed for sandbox or specific cert chains
    });
  }

  private async getToken(): Promise<string> {
    const agent = this.getAgent();
    
    const data = new URLSearchParams();
    data.append('client_id', this.clientId);
    data.append('client_secret', this.clientSecret);
    data.append('scope', 'cob.write cob.read cobv.write cobv.read lotecobv.write lotecobv.read pix.write pix.read webhook.write webhook.read payloadlocation.write payloadlocation.read boleto-cobranca.read boleto-cobranca.write extrato.read pagamento-pix.write pagamento-pix.read extrato-usend.read pagamento-boleto.read pagamento-boleto.write pagamento-darf.write pagamento-lote.write pagamento-lote.read webhook-banking.read webhook-banking.write');
    data.append('grant_type', 'client_credentials');

    try {
        const response = await axios.post(`${this.baseUrl}/oauth/v2/token`, data, {
            httpsAgent: agent,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data.access_token;
    } catch (error: any) {
        console.error("Inter Auth Error:", error.response?.data || error.message);
        throw new Error("Failed to authenticate with Banco Inter: " + (JSON.stringify(error.response?.data) || error.message));
    }
  }

  async issueBoleto(boletoData: any): Promise<{ codigoSolicitacao: string }> {
    const token = await this.getToken();
    const agent = this.getAgent();

    try {
        const response = await axios.post(`${this.baseUrl}/cobranca/v3/cobrancas`, boletoData, {
            httpsAgent: agent,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        return response.data;
    } catch (error: any) {
        console.error("Inter Issue Boleto Error:", error.response?.data || error.message);
        throw new Error("Failed to issue boleto: " + (JSON.stringify(error.response?.data) || error.message));
    }
  }

  async getPdf(codigoSolicitacao: string): Promise<string> {
    const token = await this.getToken();
    const agent = this.getAgent();

    try {
        const response = await axios.get(`${this.baseUrl}/cobranca/v3/cobrancas/${codigoSolicitacao}/pdf`, {
            httpsAgent: agent,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        return response.data.pdf; // Returns base64 string
    } catch (error: any) {
        console.error("Inter Get PDF Error:", error.response?.data || error.message);
        throw new Error("Failed to get boleto PDF");
    }
  }
}
