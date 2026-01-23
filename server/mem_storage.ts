import {
  type User, type InsertUser,
  type Landlord, type InsertLandlord,
  type Tenant, type InsertTenant,
  type ServiceProvider, type InsertServiceProvider,
  type Property, type InsertProperty,
  type Contract, type InsertContract,
  type Service, type InsertService,
  type Receipt, type InsertReceipt,
  type CashTransaction, type InsertCashTransaction,
  type LandlordTransfer, type InsertLandlordTransfer,
  type Invoice, type InsertInvoice,
} from "@shared/schema";
import type { IStorage } from "./storage";
import { randomUUID } from "crypto";

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private landlords: Map<string, Landlord> = new Map();
  private tenants: Map<string, Tenant> = new Map();
  private serviceProviders: Map<string, ServiceProvider> = new Map();
  private properties: Map<string, Property> = new Map();
  private contracts: Map<string, Contract> = new Map();
  private services: Map<string, Service> = new Map();
  private receipts: Map<string, Receipt> = new Map();
  private cashTransactions: Map<string, CashTransaction> = new Map();
  private landlordTransfers: Map<string, LandlordTransfer> = new Map();
  private invoices: Map<string, Invoice> = new Map();

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

  async getLandlords(): Promise<Landlord[]> {
    return Array.from(this.landlords.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getLandlord(id: string): Promise<Landlord | undefined> {
    return this.landlords.get(id);
  }

  async createLandlord(data: InsertLandlord): Promise<Landlord> {
    const id = data.id || randomUUID();
    const landlord: Landlord = {
      ...data,
      id,
      email: data.email || null,
      phone: data.phone || null,
      pixKey: data.pixKey || null,
      pixKeyType: data.pixKeyType || null,
      address: data.address || null,
      createdAt: new Date(),
    };
    this.landlords.set(id, landlord);
    return landlord;
  }

  async updateLandlord(id: string, data: Partial<InsertLandlord>): Promise<Landlord | undefined> {
    const existing = this.landlords.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.landlords.set(id, updated);
    return updated;
  }

  async deleteLandlord(id: string): Promise<void> {
    this.landlords.delete(id);
  }

  async getTenants(): Promise<Tenant[]> {
    return Array.from(this.tenants.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    return this.tenants.get(id);
  }

  async createTenant(data: InsertTenant): Promise<Tenant> {
    const id = data.id || randomUUID();
    const tenant: Tenant = {
      ...data,
      id,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      createdAt: new Date(),
    };
    this.tenants.set(id, tenant);
    return tenant;
  }

  async updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const existing = this.tenants.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.tenants.set(id, updated);
    return updated;
  }

  async deleteTenant(id: string): Promise<void> {
    this.tenants.delete(id);
  }

  async getServiceProviders(): Promise<ServiceProvider[]> {
    return Array.from(this.serviceProviders.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getServiceProvider(id: string): Promise<ServiceProvider | undefined> {
    return this.serviceProviders.get(id);
  }

  async createServiceProvider(data: InsertServiceProvider): Promise<ServiceProvider> {
    const id = data.id || randomUUID();
    const provider: ServiceProvider = {
      ...data,
      id,
      doc: data.doc || null,
      email: data.email || null,
      phone: data.phone || null,
      createdAt: new Date(),
    };
    this.serviceProviders.set(id, provider);
    return provider;
  }

  async updateServiceProvider(id: string, data: Partial<InsertServiceProvider>): Promise<ServiceProvider | undefined> {
    const existing = this.serviceProviders.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.serviceProviders.set(id, updated);
    return updated;
  }

  async deleteServiceProvider(id: string): Promise<void> {
    this.serviceProviders.delete(id);
  }

  async getProperties(): Promise<Property[]> {
    return Array.from(this.properties.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getProperty(id: string): Promise<Property | undefined> {
    return this.properties.get(id);
  }

  async createProperty(data: InsertProperty): Promise<Property> {
    const id = data.id || randomUUID();
    const property: Property = {
      ...data,
      id,
      landlordId: data.landlordId || null,
      status: data.status || "available",
      createdAt: new Date(),
    };
    this.properties.set(id, property);
    return property;
  }

  async updateProperty(id: string, data: Partial<InsertProperty>): Promise<Property | undefined> {
    const existing = this.properties.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.properties.set(id, updated);
    return updated;
  }

  async deleteProperty(id: string): Promise<void> {
    this.properties.delete(id);
  }

  async getContracts(): Promise<Contract[]> {
    return Array.from(this.contracts.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getActiveContracts(): Promise<Contract[]> {
    return Array.from(this.contracts.values())
      .filter((c) => c.status === "active")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getContract(id: string): Promise<Contract | undefined> {
    return this.contracts.get(id);
  }

  async createContract(data: InsertContract): Promise<Contract> {
    const id = data.id || randomUUID();
    // Ensure dates are Dates
    const contract: Contract = {
      ...data,
      id,
      startDate: typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate as unknown as string,
      endDate: typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate as unknown as string,
      firstDueDate: data.firstDueDate ? (typeof data.firstDueDate === 'string' ? new Date(data.firstDueDate) : data.firstDueDate as unknown as string) : null,
      status: data.status || "active",
      createdAt: new Date(),
    };
    // Fix type mismatch for date strings vs Date objects if schema differs
    // Schema says date(), which in Drizzle PG is string or Date? Usually string YYYY-MM-DD.
    // In memory we store what matches the type.
    this.contracts.set(id, contract);

    // Update property status
    const property = this.properties.get(data.propertyId);
    if (property) {
      property.status = "rented";
      this.properties.set(data.propertyId, property);
    }

    return contract;
  }

  async updateContract(id: string, data: Partial<InsertContract>): Promise<Contract | undefined> {
    const existing = this.contracts.get(id);
    if (!existing) return undefined;
    
    const updates: any = { ...data };
    if (data.startDate && typeof data.startDate === 'string') {
      updates.startDate = new Date(data.startDate);
    }
    if (data.endDate && typeof data.endDate === 'string') {
      updates.endDate = new Date(data.endDate);
    }
    if (data.firstDueDate && typeof data.firstDueDate === 'string') {
      updates.firstDueDate = new Date(data.firstDueDate);
    }

    const updated = { ...existing, ...updates } as Contract;
    this.contracts.set(id, updated);
    return updated;
  }

  async deleteContract(id: string): Promise<void> {
    this.contracts.delete(id);
  }

  async getServices(): Promise<Service[]> {
    return Array.from(this.services.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getServicesByContractAndRef(contractId: string, year: number, month: number): Promise<Service[]> {
    return Array.from(this.services.values()).filter(
      (s) => s.contractId === contractId && s.refYear === year && s.refMonth === month
    );
  }

  async getService(id: string): Promise<Service | undefined> {
    return this.services.get(id);
  }

  async createService(data: InsertService): Promise<Service> {
    const id = data.id || randomUUID();
    const service: Service = {
      ...data,
      id,
      providerId: data.providerId || null,
      createdAt: new Date(),
    };
    this.services.set(id, service);
    return service;
  }

  async updateService(id: string, data: Partial<InsertService>): Promise<Service | undefined> {
    const existing = this.services.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.services.set(id, updated);
    return updated;
  }

  async deleteService(id: string): Promise<void> {
    this.services.delete(id);
  }

  async getReceipts(): Promise<Receipt[]> {
    return Array.from(this.receipts.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getReceiptsByRef(year: number, month: number): Promise<Receipt[]> {
    return Array.from(this.receipts.values())
      .filter((r) => r.refYear === year && r.refMonth === month)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getReceipt(id: string): Promise<Receipt | undefined> {
    return this.receipts.get(id);
  }

  async getReceiptByContractAndRef(contractId: string, year: number, month: number): Promise<Receipt | undefined> {
    return Array.from(this.receipts.values()).find(
      (r) => r.contractId === contractId && r.refYear === year && r.refMonth === month
    );
  }

  async createReceipt(data: InsertReceipt): Promise<Receipt> {
    const id = data.id || randomUUID();
    const receipt: Receipt = {
      ...data,
      id,
      isInvoiceIssued: data.isInvoiceIssued ?? false,
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

  async getCashTransactions(): Promise<CashTransaction[]> {
    return Array.from(this.cashTransactions.values()).sort((a, b) => {
      // date can be string or Date
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }

  async getCashTransaction(id: string): Promise<CashTransaction | undefined> {
    return this.cashTransactions.get(id);
  }

  async createCashTransaction(data: InsertCashTransaction): Promise<CashTransaction> {
    const id = data.id || randomUUID();
    const transaction: CashTransaction = {
      ...data,
      id,
      date: typeof data.date === 'string' ? new Date(data.date) : data.date as unknown as string,
      createdAt: new Date(),
    };
    this.cashTransactions.set(id, transaction);
    return transaction;
  }

  async updateCashTransaction(id: string, data: Partial<InsertCashTransaction>): Promise<CashTransaction | undefined> {
    const existing = this.cashTransactions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data } as CashTransaction;
    this.cashTransactions.set(id, updated);
    return updated;
  }

  async deleteCashTransaction(id: string): Promise<void> {
    this.cashTransactions.delete(id);
  }

  async deleteCashTransactionByReceiptAndType(receiptId: string, type: "IN" | "OUT"): Promise<void> {
    for (const [id, transaction] of this.cashTransactions.entries()) {
      if (transaction.receiptId === receiptId && transaction.type === type) {
        this.cashTransactions.delete(id);
      }
    }
  }

  async getLandlordTransfers(): Promise<LandlordTransfer[]> {
    return Array.from(this.landlordTransfers.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getLandlordTransfer(id: string): Promise<LandlordTransfer | undefined> {
    return this.landlordTransfers.get(id);
  }

  async createLandlordTransfer(data: InsertLandlordTransfer): Promise<LandlordTransfer> {
    const id = data.id || randomUUID();
    const transfer: LandlordTransfer = {
      ...data,
      id,
      referenceDate: typeof data.referenceDate === 'string' ? new Date(data.referenceDate) : data.referenceDate as unknown as string,
      paidAt: data.paidAt ? (typeof data.paidAt === 'string' ? new Date(data.paidAt) : data.paidAt) : null,
      receiptUrl: data.receiptUrl || null,
      createdAt: new Date(),
    };
    this.landlordTransfers.set(id, transfer);
    return transfer;
  }

  async updateLandlordTransfer(id: string, data: Partial<InsertLandlordTransfer>): Promise<LandlordTransfer | undefined> {
    const existing = this.landlordTransfers.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data } as LandlordTransfer;
    this.landlordTransfers.set(id, updated);
    return updated;
  }

  async deleteLandlordTransfer(id: string): Promise<void> {
    this.landlordTransfers.delete(id);
  }

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
      externalId: data.externalId || null,
      pdfUrl: data.pdfUrl || null,
      errorMessage: data.errorMessage || null,
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
}
