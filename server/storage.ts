import {
  users, companies, clients, analysts, serviceCatalog, contracts, contractItems,
  receipts, cashTransactions, invoices,
  projects, projectAnalysts,
  type User, type InsertUser,
  type Company, type InsertCompany,
  type Client, type InsertClient,
  type Analyst, projectPartners,
  type Project, type InsertProject,
  type ProjectAnalyst, type InsertProjectAnalyst,
  type ProjectPartner, type InsertProjectPartner,
  partners, type Partner, type InsertPartner,
  type ServiceCatalog, type InsertServiceCatalog,
  type Contract, type InsertContract,
  type ContractItem, type InsertContractItem,
  type Receipt, type InsertReceipt,
  type CashTransaction, type InsertCashTransaction,
  type Invoice, type InsertInvoice,
  nfseConfigs, type NfseConfig, type InsertNfseConfig,
  nfseLotes, type NfseLote, type InsertNfseLote,
  nfseEmissoes, type NfseEmissao, type InsertNfseEmissao,
  timesheetEntries, type TimesheetEntry, type InsertTimesheetEntry,
  systemContracts, type SystemContract, type InsertSystemContract,
  systemLogs, type SystemLog, type InsertSystemLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte, inArray, ne, isNull } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Companies (Empresas)
  getCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  createCompany(data: InsertCompany): Promise<Company>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<void>;

  // Clients (Clientes)
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(data: InsertClient): Promise<Client>;
  updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;

  // Analysts (Analistas)
  getAnalysts(): Promise<Analyst[]>;
  getAnalyst(id: string): Promise<Analyst | undefined>;
  createAnalyst(data: InsertAnalyst): Promise<Analyst>;
  updateAnalyst(id: string, data: Partial<InsertAnalyst>): Promise<Analyst | undefined>;
  deleteAnalyst(id: string): Promise<void>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(data: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<void>;

  // Project Analysts
  getProjectAnalysts(projectId: string): Promise<(ProjectAnalyst & { analyst: Analyst })[]>;
  addProjectAnalyst(data: InsertProjectAnalyst): Promise<ProjectAnalyst>;
  removeProjectAnalyst(id: string): Promise<void>;

  // Project Partners
  getProjectPartners(projectId: string): Promise<(ProjectPartner & { partner: Partner })[]>;
  addProjectPartner(data: InsertProjectPartner): Promise<ProjectPartner>;
  removeProjectPartner(id: string): Promise<void>;

  // Service Catalog
  getServiceCatalog(): Promise<ServiceCatalog[]>;
  getServiceCatalogItem(id: string): Promise<ServiceCatalog | undefined>;
  createServiceCatalogItem(data: InsertServiceCatalog): Promise<ServiceCatalog>;
  updateServiceCatalogItem(id: string, data: Partial<InsertServiceCatalog>): Promise<ServiceCatalog | undefined>;
  deleteServiceCatalogItem(id: string): Promise<void>;

  // Contracts
  getContracts(): Promise<Contract[]>;
  getContract(id: string): Promise<Contract | undefined>;
  createContract(data: InsertContract): Promise<Contract>;
  updateContract(id: string, data: Partial<InsertContract>): Promise<Contract | undefined>;
  deleteContract(id: string): Promise<void>;

  // Contract Items
  getContractItems(contractId: string): Promise<ContractItem[]>;
  getContractItemsByRef(contractId: string, year: number, month: number): Promise<ContractItem[]>;
  createContractItem(data: InsertContractItem): Promise<ContractItem>;
  updateContractItem(id: string, data: Partial<InsertContractItem>): Promise<ContractItem | undefined>;
  deleteContractItem(id: string): Promise<void>;

  // Receipts
  getReceipts(): Promise<Receipt[]>;
  getReceiptsByRef(year: number, month: number): Promise<Receipt[]>;
  getReceipt(id: string): Promise<Receipt | undefined>;
  getReceiptByContractAndRef(contractId: string, year: number, month: number): Promise<Receipt | undefined>;
  getReceiptByProjectAndRef(projectId: string, year: number, month: number): Promise<Receipt | undefined>;
  getReceiptBySystemContractAndRef(systemContractId: string, year: number, month: number): Promise<Receipt | undefined>;
  createReceipt(data: InsertReceipt): Promise<Receipt>;
  updateReceipt(id: string, data: Partial<InsertReceipt>): Promise<Receipt | undefined>;
  deleteDraftReceiptsByContractId(contractId: string): Promise<void>;

  // Timesheet Entries
  getTimesheetEntries(receiptId: string): Promise<(TimesheetEntry & { analyst?: Analyst, partner?: Partner })[]>;
  createTimesheetEntry(data: InsertTimesheetEntry): Promise<TimesheetEntry>;
  updateTimesheetEntry(id: string, data: Partial<InsertTimesheetEntry>): Promise<TimesheetEntry>;
  deleteTimesheetEntry(id: string): Promise<void>;

  // Cash Transactions
  getCashTransactions(): Promise<CashTransaction[]>;
  getCashTransaction(id: string): Promise<CashTransaction | undefined>;
  createCashTransaction(data: InsertCashTransaction): Promise<CashTransaction>;
  updateCashTransaction(id: string, data: Partial<InsertCashTransaction>): Promise<CashTransaction | undefined>;
  deleteCashTransaction(id: string): Promise<void>;
  deleteCashTransactionByReceiptAndType(receiptId: string, type: "IN" | "OUT"): Promise<void>;

  // Invoices
  getInvoices(): Promise<Invoice[]>;
  getInvoicesByReceiptId(receiptId: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getNfseEmissaoByInvoiceId(invoiceId: string): Promise<NfseEmissao | undefined>;
  createInvoice(data: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<void>;

  // NFS-e Config
  getNfseConfig(companyId?: string): Promise<NfseConfig | undefined>;
  upsertNfseConfig(data: InsertNfseConfig): Promise<NfseConfig>;

  // NFS-e Lotes & Emissões
  createNfseLote(data: InsertNfseLote): Promise<NfseLote>;
  updateNfseLote(id: string, data: Partial<InsertNfseLote>): Promise<NfseLote | undefined>;
  getNfseLote(id: string): Promise<NfseLote | undefined>;
  createNfseEmissao(data: InsertNfseEmissao): Promise<NfseEmissao>;
  getNfseEmissoes(): Promise<NfseEmissao[]>;
  getNfseEmissao(id: string): Promise<NfseEmissao | undefined>;
  getNfseEmissaoByInvoiceId(invoiceId: string): Promise<NfseEmissao | undefined>;
  getPendingNfseEmissoes(): Promise<NfseEmissao[]>;
  updateNfseEmissao(id: string, data: Partial<InsertNfseEmissao>): Promise<NfseEmissao | undefined>;

  // System Contracts
  getSystemContracts(): Promise<SystemContract[]>;
  getSystemContract(id: string): Promise<SystemContract | undefined>;
  createSystemContract(data: InsertSystemContract): Promise<SystemContract>;
  updateSystemContract(id: string, data: Partial<InsertSystemContract>): Promise<SystemContract | undefined>;
  deleteSystemContract(id: string): Promise<void>;

  // System Logs
  createSystemLog(data: InsertSystemLog): Promise<SystemLog>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Companies
  async getCompanies(): Promise<Company[]> {
    return db.select().from(companies).orderBy(desc(companies.createdAt));
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async createCompany(data: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(data).returning();
    return company;
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const [company] = await db.update(companies).set(data).where(eq(companies.id, id)).returning();
    return company || undefined;
  }

  async deleteCompany(id: string): Promise<void> {
    await db.delete(companies).where(eq(companies.id, id));
  }

  // Clients
  async getClients(): Promise<Client[]> {
    return db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async createClient(data: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(data).returning();
    return client;
  }

  async updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db.update(clients).set(data).where(eq(clients.id, id)).returning();
    return client || undefined;
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  // Analysts
  async getAnalysts(): Promise<Analyst[]> {
    return db.select().from(analysts).orderBy(desc(analysts.createdAt));
  }

  async getAnalyst(id: string): Promise<Analyst | undefined> {
    const [analyst] = await db.select().from(analysts).where(eq(analysts.id, id));
    return analyst || undefined;
  }

  async createAnalyst(data: InsertAnalyst): Promise<Analyst> {
    const [analyst] = await db.insert(analysts).values(data).returning();
    return analyst;
  }

  async updateAnalyst(id: string, data: Partial<InsertAnalyst>): Promise<Analyst | undefined> {
    const [analyst] = await db.update(analysts).set(data).where(eq(analysts.id, id)).returning();
    return analyst || undefined;
  }

  async deleteAnalyst(id: string): Promise<void> {
    await db.delete(analysts).where(eq(analysts.id, id));
  }

  // Partners
  async getPartners(): Promise<Partner[]> {
    return db.select().from(partners).orderBy(desc(partners.createdAt));
  }

  async getPartner(id: string): Promise<Partner | undefined> {
    const [partner] = await db.select().from(partners).where(eq(partners.id, id));
    return partner || undefined;
  }

  async createPartner(data: InsertPartner): Promise<Partner> {
    const [partner] = await db.insert(partners).values(data).returning();
    return partner;
  }

  async updatePartner(id: string, data: Partial<InsertPartner>): Promise<Partner | undefined> {
    const [partner] = await db.update(partners).set(data).where(eq(partners.id, id)).returning();
    return partner || undefined;
  }

  async deletePartner(id: string): Promise<void> {
    await db.delete(partners).where(eq(partners.id, id));
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(data: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(data).returning();
    return project;
  }

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined> {
    const [project] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
    return project || undefined;
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projectAnalysts).where(eq(projectAnalysts.projectId, id)); // Clean up relations first
    await db.delete(projects).where(eq(projects.id, id));
  }

  // Project Analysts
  async getProjectAnalysts(projectId: string): Promise<(ProjectAnalyst & { analyst: Analyst })[]> {
    const result = await db
      .select({
        projectAnalyst: projectAnalysts,
        analyst: analysts,
      })
      .from(projectAnalysts)
      .innerJoin(analysts, eq(projectAnalysts.analystId, analysts.id))
      .where(eq(projectAnalysts.projectId, projectId));
    
    return result.map(({ projectAnalyst, analyst }) => ({
      ...projectAnalyst,
      analyst,
    }));
  }

  async addProjectAnalyst(data: InsertProjectAnalyst): Promise<ProjectAnalyst> {
    const [relation] = await db.insert(projectAnalysts).values(data).returning();
    return relation;
  }

  async updateProjectAnalyst(id: string, data: Partial<InsertProjectAnalyst>): Promise<ProjectAnalyst | undefined> {
    const [relation] = await db.update(projectAnalysts).set(data).where(eq(projectAnalysts.id, id)).returning();
    return relation || undefined;
  }

  async removeProjectAnalyst(id: string): Promise<void> {
    await db.delete(projectAnalysts).where(eq(projectAnalysts.id, id));
  }

  // Project Partners
  async getProjectPartners(projectId: string): Promise<(ProjectPartner & { partner: Partner })[]> {
    const result = await db
      .select({
        projectPartner: projectPartners,
        partner: partners,
      })
      .from(projectPartners)
      .innerJoin(partners, eq(projectPartners.partnerId, partners.id))
      .where(eq(projectPartners.projectId, projectId));
    
    return result.map(({ projectPartner, partner }) => ({
      ...projectPartner,
      partner,
    }));
  }

  async addProjectPartner(data: InsertProjectPartner): Promise<ProjectPartner> {
    const [relation] = await db.insert(projectPartners).values(data).returning();
    return relation;
  }

  async removeProjectPartner(id: string): Promise<void> {
    await db.delete(projectPartners).where(eq(projectPartners.id, id));
  }

  // Service Catalog
  async getServiceCatalog(): Promise<ServiceCatalog[]> {
    return db.select().from(serviceCatalog).orderBy(desc(serviceCatalog.createdAt));
  }

  async getServiceCatalogItem(id: string): Promise<ServiceCatalog | undefined> {
    const [item] = await db.select().from(serviceCatalog).where(eq(serviceCatalog.id, id));
    return item || undefined;
  }

  async createServiceCatalogItem(data: InsertServiceCatalog): Promise<ServiceCatalog> {
    const [item] = await db.insert(serviceCatalog).values(data).returning();
    return item;
  }

  async updateServiceCatalogItem(id: string, data: Partial<InsertServiceCatalog>): Promise<ServiceCatalog | undefined> {
    const [item] = await db.update(serviceCatalog).set(data).where(eq(serviceCatalog.id, id)).returning();
    return item || undefined;
  }

  async deleteServiceCatalogItem(id: string): Promise<void> {
    await db.delete(serviceCatalog).where(eq(serviceCatalog.id, id));
  }

  // Contracts
  async getContracts(): Promise<Contract[]> {
    return db.select().from(contracts).orderBy(desc(contracts.createdAt));
  }

  async getContract(id: string): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    return contract || undefined;
  }

  async createContract(data: InsertContract): Promise<Contract> {
    const [contract] = await db.insert(contracts).values(data).returning();
    return contract;
  }

  async updateContract(id: string, data: Partial<InsertContract>): Promise<Contract | undefined> {
    const [contract] = await db.update(contracts).set(data).where(eq(contracts.id, id)).returning();
    return contract || undefined;
  }

  async deleteContract(id: string): Promise<void> {
    await db.delete(contracts).where(eq(contracts.id, id));
  }

  // Contract Items
  async getContractItems(contractId: string): Promise<ContractItem[]> {
    return db.select().from(contractItems).where(eq(contractItems.contractId, contractId));
  }

  async getContractItemsByRef(contractId: string, year: number, month: number): Promise<ContractItem[]> {
    return db.select().from(contractItems).where(
      and(
        eq(contractItems.contractId, contractId),
        eq(contractItems.refYear, year),
        eq(contractItems.refMonth, month)
      )
    );
  }

  async createContractItem(data: InsertContractItem): Promise<ContractItem> {
    const [item] = await db.insert(contractItems).values(data).returning();
    return item;
  }

  async updateContractItem(id: string, data: Partial<InsertContractItem>): Promise<ContractItem | undefined> {
    const [item] = await db.update(contractItems).set(data).where(eq(contractItems.id, id)).returning();
    return item || undefined;
  }

  async deleteContractItem(id: string): Promise<void> {
    await db.delete(contractItems).where(eq(contractItems.id, id));
  }

  // Receipts
  async getReceipts(): Promise<Receipt[]> {
    return db.select().from(receipts).orderBy(desc(receipts.createdAt));
  }

  async getReceiptsByRef(year: number, month: number): Promise<Receipt[]> {
    return db.select().from(receipts).where(and(eq(receipts.refYear, year), eq(receipts.refMonth, month)));
  }

  async getReceipt(id: string): Promise<Receipt | undefined> {
    const [receipt] = await db.select().from(receipts).where(eq(receipts.id, id));
    return receipt || undefined;
  }

  async getReceiptByContractAndRef(contractId: string, year: number, month: number): Promise<Receipt | undefined> {
    const [receipt] = await db.select().from(receipts).where(
      and(
        eq(receipts.contractId, contractId),
        eq(receipts.refYear, year),
        eq(receipts.refMonth, month)
      )
    );
    return receipt || undefined;
  }

  async getReceiptByProjectAndRef(projectId: string, year: number, month: number): Promise<Receipt | undefined> {
    const [receipt] = await db.select().from(receipts).where(
      and(
        eq(receipts.projectId, projectId),
        eq(receipts.refYear, year),
        eq(receipts.refMonth, month)
      )
    );
    return receipt || undefined;
  }

  async getReceiptBySystemContractAndRef(systemContractId: string, year: number, month: number): Promise<Receipt | undefined> {
    const [receipt] = await db.select().from(receipts).where(
      and(
        eq(receipts.systemContractId, systemContractId),
        eq(receipts.refYear, year),
        eq(receipts.refMonth, month)
      )
    );
    return receipt || undefined;
  }

  async createReceipt(data: InsertReceipt): Promise<Receipt> {
    const [receipt] = await db.insert(receipts).values(data).returning();
    return receipt;
  }

  async updateReceipt(id: string, data: Partial<InsertReceipt>): Promise<Receipt | undefined> {
    const [receipt] = await db.update(receipts).set(data).where(eq(receipts.id, id)).returning();
    return receipt || undefined;
  }

  async deleteReceipt(id: string): Promise<void> {
    // Delete related records first
    await db.delete(cashTransactions).where(eq(cashTransactions.receiptId, id));
    await db.delete(invoices).where(eq(invoices.receiptId, id));
    await db.delete(timesheetEntries).where(eq(timesheetEntries.receiptId, id));
    await db.delete(receipts).where(eq(receipts.id, id));
  }

  async deleteDraftReceiptsByContractId(contractId: string): Promise<void> {
    const receiptsToDelete = await db
      .select({ id: receipts.id })
      .from(receipts)
      .where(and(eq(receipts.contractId, contractId), eq(receipts.status, "draft")));

    if (receiptsToDelete.length === 0) return;

    const ids = receiptsToDelete.map(r => r.id);
    await db.delete(cashTransactions).where(inArray(cashTransactions.receiptId, ids));
    await db.delete(invoices).where(inArray(invoices.receiptId, ids));
    await db.delete(timesheetEntries).where(inArray(timesheetEntries.receiptId, ids));
    await db.delete(receipts).where(inArray(receipts.id, ids));
  }

  // Timesheet Entries
  async getTimesheetEntries(receiptId: string): Promise<(TimesheetEntry & { analyst?: Analyst, partner?: Partner })[]> {
    const result = await db
      .select({
        entry: timesheetEntries,
        analyst: analysts,
        partner: partners,
      })
      .from(timesheetEntries)
      .leftJoin(analysts, eq(timesheetEntries.analystId, analysts.id))
      .leftJoin(partners, eq(timesheetEntries.partnerId, partners.id))
      .where(eq(timesheetEntries.receiptId, receiptId))
      .orderBy(desc(timesheetEntries.createdAt));
      
    return result.map(({ entry, analyst, partner }) => ({
      ...entry,
      analyst: analyst || undefined,
      partner: partner || undefined,
    }));
  }

  async getTimesheetEntry(id: string): Promise<TimesheetEntry | undefined> {
    const [entry] = await db.select().from(timesheetEntries).where(eq(timesheetEntries.id, id));
    return entry || undefined;
  }

  async createTimesheetEntry(data: InsertTimesheetEntry): Promise<TimesheetEntry> {
    const [entry] = await db.insert(timesheetEntries).values(data).returning();
    return entry;
  }

  async updateTimesheetEntry(id: string, data: Partial<InsertTimesheetEntry>): Promise<TimesheetEntry> {
    const [entry] = await db.update(timesheetEntries).set(data).where(eq(timesheetEntries.id, id)).returning();
    return entry;
  }

  async deleteTimesheetEntry(id: string): Promise<void> {
    await db.delete(timesheetEntries).where(eq(timesheetEntries.id, id));
  }

  // Cash Transactions
  async getCashTransactions(): Promise<CashTransaction[]> {
    return db.select().from(cashTransactions).orderBy(desc(cashTransactions.date));
  }

  async getCashTransaction(id: string): Promise<CashTransaction | undefined> {
    const [transaction] = await db.select().from(cashTransactions).where(eq(cashTransactions.id, id));
    return transaction || undefined;
  }

  async createCashTransaction(data: InsertCashTransaction): Promise<CashTransaction> {
    const [transaction] = await db.insert(cashTransactions).values(data).returning();
    return transaction;
  }

  async updateCashTransaction(id: string, data: Partial<InsertCashTransaction>): Promise<CashTransaction | undefined> {
    const [transaction] = await db.update(cashTransactions).set(data).where(eq(cashTransactions.id, id)).returning();
    return transaction || undefined;
  }

  async deleteCashTransaction(id: string): Promise<void> {
    await db.delete(cashTransactions).where(eq(cashTransactions.id, id));
  }

  async deleteCashTransactionByReceiptAndType(receiptId: string, type: "IN" | "OUT"): Promise<void> {
    await db.delete(cashTransactions).where(
      and(
        eq(cashTransactions.receiptId, receiptId),
        eq(cashTransactions.type, type)
      )
    );
  }

  // Invoices
  async getInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getInvoicesByReceiptId(receiptId: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.receiptId, receiptId));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async getNfseEmissaoByInvoiceId(invoiceId: string): Promise<NfseEmissao | undefined> {
    const [emissao] = await db.select().from(nfseEmissoes)
      .where(and(
        eq(nfseEmissoes.origemId, invoiceId),
        eq(nfseEmissoes.origemTipo, "INVOICE")
      ))
      .orderBy(desc(nfseEmissoes.createdAt));
    return emissao || undefined;
  }

  async createInvoice(data: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(data).returning();
    return invoice;
  }

  async updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [invoice] = await db.update(invoices).set(data).where(eq(invoices.id, id)).returning();
    return invoice || undefined;
  }

  async deleteInvoice(id: string): Promise<void> {
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  // NFS-e Config
  async getNfseConfig(companyId?: string): Promise<NfseConfig | undefined> {
    if (companyId) {
      const [config] = await db.select().from(nfseConfigs).where(eq(nfseConfigs.companyId, companyId)).limit(1);
      return config || undefined;
    }
    const [config] = await db.select().from(nfseConfigs).where(isNull(nfseConfigs.companyId)).limit(1);
    return config || undefined;
  }

  async upsertNfseConfig(data: InsertNfseConfig): Promise<NfseConfig> {
    const existing = await this.getNfseConfig(data.companyId || undefined);
    
    if (existing) {
      const [updated] = await db
        .update(nfseConfigs)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(nfseConfigs.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(nfseConfigs).values(data).returning();
    return created;
  }

  // NFS-e Lotes & Emissões
  async createNfseLote(data: InsertNfseLote): Promise<NfseLote> {
    const [lote] = await db.insert(nfseLotes).values(data).returning();
    return lote;
  }

  async updateNfseLote(id: string, data: Partial<InsertNfseLote>): Promise<NfseLote | undefined> {
    const [lote] = await db.update(nfseLotes).set(data).where(eq(nfseLotes.id, id)).returning();
    return lote || undefined;
  }

  async getNfseLote(id: string): Promise<NfseLote | undefined> {
    const [lote] = await db.select().from(nfseLotes).where(eq(nfseLotes.id, id));
    return lote || undefined;
  }

  async createNfseEmissao(data: InsertNfseEmissao): Promise<NfseEmissao> {
    const [emissao] = await db.insert(nfseEmissoes).values(data).returning();
    return emissao;
  }

  async getNfseEmissoes(): Promise<NfseEmissao[]> {
    return db.select().from(nfseEmissoes).orderBy(desc(nfseEmissoes.createdAt));
  }

  async getNfseEmissao(id: string): Promise<NfseEmissao | undefined> {
    const [emissao] = await db.select().from(nfseEmissoes).where(eq(nfseEmissoes.id, id));
    return emissao || undefined;
  }


  async getPendingNfseEmissoes(): Promise<NfseEmissao[]> {
    return db.select().from(nfseEmissoes).where(eq(nfseEmissoes.status, "PENDENTE"));
  }

  async updateNfseEmissao(id: string, data: Partial<InsertNfseEmissao>): Promise<NfseEmissao | undefined> {
    const [emissao] = await db.update(nfseEmissoes).set({ ...data, updatedAt: new Date() }).where(eq(nfseEmissoes.id, id)).returning();
    return emissao || undefined;
  }

  // System Contracts
  async getSystemContracts(): Promise<SystemContract[]> {
    return db.select().from(systemContracts).orderBy(desc(systemContracts.createdAt));
  }

  async getSystemContract(id: string): Promise<SystemContract | undefined> {
    const [contract] = await db.select().from(systemContracts).where(eq(systemContracts.id, id));
    return contract || undefined;
  }

  async createSystemContract(data: InsertSystemContract): Promise<SystemContract> {
    const [contract] = await db.insert(systemContracts).values(data).returning();
    return contract;
  }

  async updateSystemContract(id: string, data: Partial<InsertSystemContract>): Promise<SystemContract | undefined> {
    const [contract] = await db.update(systemContracts).set(data).where(eq(systemContracts.id, id)).returning();
    return contract || undefined;
  }

  async deleteSystemContract(id: string): Promise<void> {
    await db.delete(systemContracts).where(eq(systemContracts.id, id));
  }

  // System Logs
  async createSystemLog(data: InsertSystemLog): Promise<SystemLog> {
    const [log] = await db.insert(systemLogs).values(data).returning();
    return log;
  }

  async getSystemLogs(): Promise<SystemLog[]> {
    return db.select().from(systemLogs).orderBy(desc(systemLogs.createdAt));
  }

  async clearSystemLogs(): Promise<void> {
    await db.delete(systemLogs);
  }
}

export const storage = new DatabaseStorage();
