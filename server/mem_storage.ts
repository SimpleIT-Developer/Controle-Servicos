import {
  type User, type InsertUser,
  type Company, type InsertCompany,
  type Client, type InsertClient,
  type Analyst, type InsertAnalyst,
  type ServiceCatalog, type InsertServiceCatalog,
  type Contract, type InsertContract,
  type ContractItem, type InsertContractItem,
  type Receipt, type InsertReceipt,
  type CashTransaction, type InsertCashTransaction,
  type Invoice, type InsertInvoice,
  type NfseConfig, type InsertNfseConfig,
  type NfseLote, type InsertNfseLote,
  type NfseEmissao, type InsertNfseEmissao,
  type SystemLog, type InsertSystemLog,
} from "@shared/schema";
import type { IStorage } from "./storage";
import { randomUUID } from "crypto";

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private companies: Map<string, Company> = new Map();
  private clients: Map<string, Client> = new Map();
  private analysts: Map<string, Analyst> = new Map();
  private serviceCatalog: Map<string, ServiceCatalog> = new Map();
  private contracts: Map<string, Contract> = new Map();
  private contractItems: Map<string, ContractItem> = new Map();
  private receipts: Map<string, Receipt> = new Map();
  private cashTransactions: Map<string, CashTransaction> = new Map();
  private invoices: Map<string, Invoice> = new Map();
  private nfseConfig: NfseConfig | undefined;
  private nfseLotes: Map<string, NfseLote> = new Map();
  private nfseEmissoes: Map<string, NfseEmissao> = new Map();
  private systemLogs: Map<string, SystemLog> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = insertUser.id || randomUUID();
    const user: User = {
      ...insertUser,
      id,
      role: insertUser.role || "user",
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  // Companies
  async getCompanies(): Promise<Company[]> {
    return Array.from(this.companies.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getCompany(id: string): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async createCompany(data: InsertCompany): Promise<Company> {
    const id = data.id || randomUUID();
    const company: Company = {
      ...data,
      id,
      tradeName: data.tradeName || null,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
      city: data.city || null,
      state: data.state || null,
      zipCode: data.zipCode || null,
      bank: data.bank || null,
      branch: data.branch || null,
      account: data.account || null,
      pixKeyType: data.pixKeyType || null,
      pixKey: data.pixKey || null,
      createdAt: new Date(),
    };
    this.companies.set(id, company);
    return company;
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const existing = this.companies.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.companies.set(id, updated);
    return updated;
  }

  async deleteCompany(id: string): Promise<void> {
    this.companies.delete(id);
  }

  // Clients
  async getClients(): Promise<Client[]> {
    return Array.from(this.clients.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async createClient(data: InsertClient): Promise<Client> {
    const id = data.id || randomUUID();
    const client: Client = {
      ...data,
      id,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
      city: data.city || null,
      state: data.state || null,
      zipCode: data.zipCode || null,
      createdAt: new Date(),
    };
    this.clients.set(id, client);
    return client;
  }

  async updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined> {
    const existing = this.clients.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.clients.set(id, updated);
    return updated;
  }

  async deleteClient(id: string): Promise<void> {
    this.clients.delete(id);
  }

  // Analysts
  async getAnalysts(): Promise<Analyst[]> {
    return Array.from(this.analysts.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAnalyst(id: string): Promise<Analyst | undefined> {
    return this.analysts.get(id);
  }

  async createAnalyst(data: InsertAnalyst): Promise<Analyst> {
    const id = data.id || randomUUID();
    const analyst: Analyst = {
      ...data,
      id,
      email: data.email || null,
      phone: data.phone || null,
      role: data.role || null,
      createdAt: new Date(),
    };
    this.analysts.set(id, analyst);
    return analyst;
  }

  async updateAnalyst(id: string, data: Partial<InsertAnalyst>): Promise<Analyst | undefined> {
    const existing = this.analysts.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.analysts.set(id, updated);
    return updated;
  }

  async deleteAnalyst(id: string): Promise<void> {
    this.analysts.delete(id);
  }

  // Service Catalog
  async getServiceCatalog(): Promise<ServiceCatalog[]> {
    return Array.from(this.serviceCatalog.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getServiceCatalogItem(id: string): Promise<ServiceCatalog | undefined> {
    return this.serviceCatalog.get(id);
  }

  async createServiceCatalogItem(data: InsertServiceCatalog): Promise<ServiceCatalog> {
    const id = data.id || randomUUID();
    const item: ServiceCatalog = {
      ...data,
      id,
      description: data.description || null,
      price: data.price ? String(data.price) : null,
      createdAt: new Date(),
    };
    this.serviceCatalog.set(id, item);
    return item;
  }

  async updateServiceCatalogItem(id: string, data: Partial<InsertServiceCatalog>): Promise<ServiceCatalog | undefined> {
    const existing = this.serviceCatalog.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.serviceCatalog.set(id, updated);
    return updated;
  }

  async deleteServiceCatalogItem(id: string): Promise<void> {
    this.serviceCatalog.delete(id);
  }

  // Contracts
  async getContracts(): Promise<Contract[]> {
    return Array.from(this.contracts.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getContract(id: string): Promise<Contract | undefined> {
    return this.contracts.get(id);
  }

  async createContract(data: InsertContract): Promise<Contract> {
    const id = data.id || randomUUID();
    const contract: Contract = {
      ...data,
      id,
      endDate: data.endDate || null,
      amount: String(data.amount),
      status: data.status || "active",
      createdAt: new Date(),
    };
    this.contracts.set(id, contract);
    return contract;
  }

  async updateContract(id: string, data: Partial<InsertContract>): Promise<Contract | undefined> {
    const existing = this.contracts.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.contracts.set(id, updated);
    return updated;
  }

  async deleteContract(id: string): Promise<void> {
    this.contracts.delete(id);
  }

  // Contract Items
  async getContractItems(contractId: string): Promise<ContractItem[]> {
    return Array.from(this.contractItems.values())
      .filter(i => i.contractId === contractId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getContractItemsByRef(contractId: string, year: number, month: number): Promise<ContractItem[]> {
    return Array.from(this.contractItems.values())
      .filter(i => i.contractId === contractId && i.refYear === year && i.refMonth === month)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createContractItem(data: InsertContractItem): Promise<ContractItem> {
    const id = data.id || randomUUID();
    const item: ContractItem = {
      ...data,
      id,
      serviceCatalogId: data.serviceCatalogId || null,
      analystId: data.analystId || null,
      amount: String(data.amount),
      chargedTo: data.chargedTo || "CLIENT",
      passThrough: data.passThrough ?? false,
      createdAt: new Date(),
    };
    this.contractItems.set(id, item);
    return item;
  }

  async updateContractItem(id: string, data: Partial<InsertContractItem>): Promise<ContractItem | undefined> {
    const existing = this.contractItems.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.contractItems.set(id, updated);
    return updated;
  }

  async deleteContractItem(id: string): Promise<void> {
    this.contractItems.delete(id);
  }

  // Receipts
  async getReceipts(): Promise<Receipt[]> {
    return Array.from(this.receipts.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getReceiptsByRef(year: number, month: number): Promise<Receipt[]> {
    return Array.from(this.receipts.values())
      .filter(r => r.refYear === year && r.refMonth === month)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getReceipt(id: string): Promise<Receipt | undefined> {
    return this.receipts.get(id);
  }

  async getReceiptByContractAndRef(contractId: string, year: number, month: number): Promise<Receipt | undefined> {
    return Array.from(this.receipts.values()).find(
      r => r.contractId === contractId && r.refYear === year && r.refMonth === month
    );
  }

  async createReceipt(data: InsertReceipt): Promise<Receipt> {
    const id = data.id || randomUUID();
    const receipt: Receipt = {
      ...data,
      id,
      servicesAmount: data.servicesAmount ? String(data.servicesAmount) : "0",
      amount: String(data.amount),
      totalDue: String(data.totalDue),
      status: data.status || "draft",
      isInvoiceGenerated: data.isInvoiceGenerated || false,
      isInvoiceIssued: data.isInvoiceIssued || false,
      isInvoiceCancelled: data.isInvoiceCancelled || false,
      createdAt: new Date(),
    };
    this.receipts.set(id, receipt);
    return receipt;
  }

  async updateReceipt(id: string, data: Partial<InsertReceipt>): Promise<Receipt | undefined> {
    const existing = this.receipts.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.receipts.set(id, updated);
    return updated;
  }

  async deleteDraftReceiptsByContractId(contractId: string): Promise<void> {
    for (const [id, receipt] of this.receipts.entries()) {
      if (receipt.contractId === contractId && receipt.status === "draft") {
        this.receipts.delete(id);
      }
    }
  }

  // Cash Transactions
  async getCashTransactions(): Promise<CashTransaction[]> {
    return Array.from(this.cashTransactions.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getCashTransaction(id: string): Promise<CashTransaction | undefined> {
    return this.cashTransactions.get(id);
  }

  async createCashTransaction(data: InsertCashTransaction): Promise<CashTransaction> {
    const id = data.id || randomUUID();
    const transaction: CashTransaction = {
      ...data,
      id,
      description: data.description || null,
      receiptId: data.receiptId || null,
      amount: String(data.amount),
      date: typeof data.date === 'string' ? data.date : new Date().toISOString(), // Simplified date handling
      createdAt: new Date(),
    };
    this.cashTransactions.set(id, transaction);
    return transaction;
  }

  async updateCashTransaction(id: string, data: Partial<InsertCashTransaction>): Promise<CashTransaction | undefined> {
    const existing = this.cashTransactions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.cashTransactions.set(id, updated);
    return updated;
  }

  async deleteCashTransaction(id: string): Promise<void> {
    this.cashTransactions.delete(id);
  }

  async deleteCashTransactionByReceiptAndType(receiptId: string, type: "IN" | "OUT"): Promise<void> {
    for (const [id, tx] of this.cashTransactions.entries()) {
      if (tx.receiptId === receiptId && tx.type === type) {
        this.cashTransactions.delete(id);
      }
    }
  }

  // Invoices
  async getInvoices(): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  async createInvoice(data: InsertInvoice): Promise<Invoice> {
    const id = data.id || randomUUID();
    const invoice: Invoice = {
      ...data,
      id,
      number: data.number || null,
      verificationCode: data.verificationCode || null,
      xmlUrl: data.xmlUrl || null,
      pdfUrl: data.pdfUrl || null,
      errorMessage: data.errorMessage || null,
      issuedAt: data.issuedAt || null,
      status: data.status || "PENDENTE",
      createdAt: new Date(),
    };
    this.invoices.set(id, invoice);
    return invoice;
  }

  async updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const existing = this.invoices.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.invoices.set(id, updated);
    return updated;
  }

  async deleteInvoice(id: string): Promise<void> {
    this.invoices.delete(id);
  }

  // NFS-e Config
  async getNfseConfig(): Promise<NfseConfig | undefined> {
    return this.nfseConfig;
  }

  async upsertNfseConfig(data: InsertNfseConfig): Promise<NfseConfig> {
    const config: NfseConfig = {
      id: this.nfseConfig?.id || randomUUID(),
      cidade: data.cidade || "Tatuí",
      ambiente: data.ambiente || "homologacao",
      login: data.login || null,
      senha: data.senha || null,
      token: data.token || null,
      clientSecret: data.clientSecret || null,
      itemServico: data.itemServico || "11.01",
      serieNfse: data.serieNfse || "900",
      updatedAt: new Date(),
    };
    this.nfseConfig = config;
    return config;
  }

  // NFS-e Lotes & Emissões
  async createNfseLote(data: InsertNfseLote): Promise<NfseLote> {
    const id = data.id || randomUUID();
    const lote: NfseLote = {
      ...data,
      id,
      status: data.status || "CRIADO",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.nfseLotes.set(id, lote);
    return lote;
  }

  async updateNfseLote(id: string, data: Partial<InsertNfseLote>): Promise<NfseLote | undefined> {
    const existing = this.nfseLotes.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.nfseLotes.set(id, updated);
    return updated;
  }

  async getNfseLote(id: string): Promise<NfseLote | undefined> {
    return this.nfseLotes.get(id);
  }

  async createNfseEmissao(data: InsertNfseEmissao): Promise<NfseEmissao> {
    const id = data.id || randomUUID();
    const emissao: NfseEmissao = {
      ...data,
      id,
      loteId: data.loteId || null,
      numero: data.numero || null,
      codigoVerificacao: data.codigoVerificacao || null,
      linkUrl: data.linkUrl || null,
      xmlUrl: data.xmlUrl || null,
      error: data.error || null,
      valor: data.valor ? String(data.valor) : null,
      tomadorNome: data.tomadorNome || null,
      tomadorCpfCnpj: data.tomadorCpfCnpj || null,
      discriminacao: data.discriminacao || null,
      status: data.status || "PENDENTE",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.nfseEmissoes.set(id, emissao);
    return emissao;
  }

  async getNfseEmissoes(): Promise<NfseEmissao[]> {
    return Array.from(this.nfseEmissoes.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getNfseEmissao(id: string): Promise<NfseEmissao | undefined> {
    return this.nfseEmissoes.get(id);
  }

  async getPendingNfseEmissoes(): Promise<NfseEmissao[]> {
    return Array.from(this.nfseEmissoes.values()).filter(e => e.status === "PENDENTE");
  }

  async updateNfseEmissao(id: string, data: Partial<InsertNfseEmissao>): Promise<NfseEmissao | undefined> {
    const existing = this.nfseEmissoes.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.nfseEmissoes.set(id, updated);
    return updated;
  }

  // System Logs
  async createSystemLog(data: InsertSystemLog): Promise<SystemLog> {
    const id = data.id || randomUUID();
    const log: SystemLog = {
      ...data,
      id,
      details: data.details || null,
      correlationId: data.correlationId || null,
      createdAt: new Date(),
    };
    this.systemLogs.set(id, log);
    return log;
  }

  async getSystemLogs(): Promise<SystemLog[]> {
    return Array.from(this.systemLogs.values()).sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async clearSystemLogs(): Promise<void> {
    this.systemLogs.clear();
  }

  // System Contracts (Stub implementation to satisfy IStorage)
  async getSystemContracts(): Promise<SystemContract[]> { return []; }
  async getSystemContract(id: string): Promise<SystemContract | undefined> { return undefined; }
  async createSystemContract(data: InsertSystemContract): Promise<SystemContract> { throw new Error("Not implemented"); }
  async updateSystemContract(id: string, data: Partial<InsertSystemContract>): Promise<SystemContract | undefined> { return undefined; }
  async deleteSystemContract(id: string): Promise<void> {}
}
