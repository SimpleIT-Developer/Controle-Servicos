import {
  users, landlords, tenants, serviceProviders, properties, contracts, services,
  receipts, cashTransactions, landlordTransfers, invoices,
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
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import { MemStorage } from "./mem_storage";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getLandlords(): Promise<Landlord[]>;
  getLandlord(id: string): Promise<Landlord | undefined>;
  createLandlord(data: InsertLandlord): Promise<Landlord>;
  updateLandlord(id: string, data: Partial<InsertLandlord>): Promise<Landlord | undefined>;
  deleteLandlord(id: string): Promise<void>;

  getTenants(): Promise<Tenant[]>;
  getTenant(id: string): Promise<Tenant | undefined>;
  createTenant(data: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined>;
  deleteTenant(id: string): Promise<void>;

  getServiceProviders(): Promise<ServiceProvider[]>;
  getServiceProvider(id: string): Promise<ServiceProvider | undefined>;
  createServiceProvider(data: InsertServiceProvider): Promise<ServiceProvider>;
  updateServiceProvider(id: string, data: Partial<InsertServiceProvider>): Promise<ServiceProvider | undefined>;
  deleteServiceProvider(id: string): Promise<void>;

  getProperties(): Promise<Property[]>;
  getProperty(id: string): Promise<Property | undefined>;
  createProperty(data: InsertProperty): Promise<Property>;
  updateProperty(id: string, data: Partial<InsertProperty>): Promise<Property | undefined>;
  deleteProperty(id: string): Promise<void>;

  getContracts(): Promise<Contract[]>;
  getActiveContracts(): Promise<Contract[]>;
  getContract(id: string): Promise<Contract | undefined>;
  createContract(data: InsertContract): Promise<Contract>;
  updateContract(id: string, data: Partial<InsertContract>): Promise<Contract | undefined>;
  deleteContract(id: string): Promise<void>;

  getServices(): Promise<Service[]>;
  getServicesByContractAndRef(contractId: string, year: number, month: number): Promise<Service[]>;
  getService(id: string): Promise<Service | undefined>;
  createService(data: InsertService): Promise<Service>;
  updateService(id: string, data: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: string): Promise<void>;

  getReceipts(): Promise<Receipt[]>;
  getReceiptsByRef(year: number, month: number): Promise<Receipt[]>;
  getReceipt(id: string): Promise<Receipt | undefined>;
  getReceiptByContractAndRef(contractId: string, year: number, month: number): Promise<Receipt | undefined>;
  createReceipt(data: InsertReceipt): Promise<Receipt>;
  updateReceipt(id: string, data: Partial<InsertReceipt>): Promise<Receipt | undefined>;
  deleteDraftReceiptsByContractId(contractId: string): Promise<void>;

  getCashTransactions(): Promise<CashTransaction[]>;
  getCashTransaction(id: string): Promise<CashTransaction | undefined>;
  createCashTransaction(data: InsertCashTransaction): Promise<CashTransaction>;
  updateCashTransaction(id: string, data: Partial<InsertCashTransaction>): Promise<CashTransaction | undefined>;
  deleteCashTransaction(id: string): Promise<void>;
  deleteCashTransactionByReceiptAndType(receiptId: string, type: "IN" | "OUT"): Promise<void>;

  getLandlordTransfers(): Promise<LandlordTransfer[]>;
  getLandlordTransfer(id: string): Promise<LandlordTransfer | undefined>;
  createLandlordTransfer(data: InsertLandlordTransfer): Promise<LandlordTransfer>;
  updateLandlordTransfer(id: string, data: Partial<InsertLandlordTransfer>): Promise<LandlordTransfer | undefined>;
  deleteLandlordTransfer(id: string): Promise<void>;

  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(data: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<void>;
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

  async getLandlords(): Promise<Landlord[]> {
    return db.select().from(landlords).orderBy(desc(landlords.createdAt));
  }

  async getLandlord(id: string): Promise<Landlord | undefined> {
    const [landlord] = await db.select().from(landlords).where(eq(landlords.id, id));
    return landlord || undefined;
  }

  async createLandlord(data: InsertLandlord): Promise<Landlord> {
    const [landlord] = await db.insert(landlords).values(data).returning();
    return landlord;
  }

  async updateLandlord(id: string, data: Partial<InsertLandlord>): Promise<Landlord | undefined> {
    const [landlord] = await db.update(landlords).set(data).where(eq(landlords.id, id)).returning();
    return landlord || undefined;
  }

  async deleteLandlord(id: string): Promise<void> {
    await db.delete(landlords).where(eq(landlords.id, id));
  }

  async getTenants(): Promise<Tenant[]> {
    return db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant || undefined;
  }

  async createTenant(data: InsertTenant): Promise<Tenant> {
    const [tenant] = await db.insert(tenants).values(data).returning();
    return tenant;
  }

  async updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const [tenant] = await db.update(tenants).set(data).where(eq(tenants.id, id)).returning();
    return tenant || undefined;
  }

  async deleteTenant(id: string): Promise<void> {
    await db.delete(tenants).where(eq(tenants.id, id));
  }

  async getServiceProviders(): Promise<ServiceProvider[]> {
    return db.select().from(serviceProviders).orderBy(desc(serviceProviders.createdAt));
  }

  async getServiceProvider(id: string): Promise<ServiceProvider | undefined> {
    const [provider] = await db.select().from(serviceProviders).where(eq(serviceProviders.id, id));
    return provider || undefined;
  }

  async createServiceProvider(data: InsertServiceProvider): Promise<ServiceProvider> {
    const [provider] = await db.insert(serviceProviders).values(data).returning();
    return provider;
  }

  async updateServiceProvider(id: string, data: Partial<InsertServiceProvider>): Promise<ServiceProvider | undefined> {
    const [provider] = await db.update(serviceProviders).set(data).where(eq(serviceProviders.id, id)).returning();
    return provider || undefined;
  }

  async deleteServiceProvider(id: string): Promise<void> {
    await db.delete(serviceProviders).where(eq(serviceProviders.id, id));
  }

  async getProperties(): Promise<Property[]> {
    return db.select().from(properties).orderBy(desc(properties.createdAt));
  }

  async getProperty(id: string): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property || undefined;
  }

  async createProperty(data: InsertProperty): Promise<Property> {
    const [property] = await db.insert(properties).values(data).returning();
    return property;
  }

  async updateProperty(id: string, data: Partial<InsertProperty>): Promise<Property | undefined> {
    const [property] = await db.update(properties).set(data).where(eq(properties.id, id)).returning();
    return property || undefined;
  }

  async deleteProperty(id: string): Promise<void> {
    await db.delete(properties).where(eq(properties.id, id));
  }

  async getContracts(): Promise<Contract[]> {
    return db.select().from(contracts).orderBy(desc(contracts.createdAt));
  }

  async getActiveContracts(): Promise<Contract[]> {
    return db.select().from(contracts).where(eq(contracts.status, "active")).orderBy(desc(contracts.createdAt));
  }

  async getContract(id: string): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    return contract || undefined;
  }

  async createContract(data: InsertContract): Promise<Contract> {
    const [contract] = await db.insert(contracts).values(data).returning();
    await db
      .update(properties)
      .set({ status: "rented" })
      .where(eq(properties.id, data.propertyId));
    return contract;
  }

  async updateContract(id: string, data: Partial<InsertContract>): Promise<Contract | undefined> {
    const [contract] = await db.update(contracts).set(data).where(eq(contracts.id, id)).returning();
    return contract || undefined;
  }

  async deleteContract(id: string): Promise<void> {
    await db.delete(contracts).where(eq(contracts.id, id));
  }

  async getServices(): Promise<Service[]> {
    return db.select().from(services).orderBy(desc(services.createdAt));
  }

  async getServicesByContractAndRef(contractId: string, year: number, month: number): Promise<Service[]> {
    return db.select().from(services).where(
      and(eq(services.contractId, contractId), eq(services.refYear, year), eq(services.refMonth, month))
    );
  }

  async getService(id: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service || undefined;
  }

  async createService(data: InsertService): Promise<Service> {
    const [service] = await db.insert(services).values(data).returning();
    return service;
  }

  async updateService(id: string, data: Partial<InsertService>): Promise<Service | undefined> {
    const [service] = await db.update(services).set(data).where(eq(services.id, id)).returning();
    return service || undefined;
  }

  async deleteService(id: string): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }

  async getReceipts(): Promise<Receipt[]> {
    return db.select().from(receipts).orderBy(desc(receipts.createdAt));
  }

  async getReceiptsByRef(year: number, month: number): Promise<Receipt[]> {
    return db.select().from(receipts).where(
      and(eq(receipts.refYear, year), eq(receipts.refMonth, month))
    ).orderBy(desc(receipts.createdAt));
  }

  async getReceipt(id: string): Promise<Receipt | undefined> {
    const [receipt] = await db.select().from(receipts).where(eq(receipts.id, id));
    return receipt || undefined;
  }

  async getReceiptByContractAndRef(contractId: string, year: number, month: number): Promise<Receipt | undefined> {
    const [receipt] = await db.select().from(receipts).where(
      and(eq(receipts.contractId, contractId), eq(receipts.refYear, year), eq(receipts.refMonth, month))
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

  async deleteDraftReceiptsByContractId(contractId: string): Promise<void> {
    await db.delete(receipts).where(
      and(
        eq(receipts.contractId, contractId),
        eq(receipts.status, "draft")
      )
    );
  }

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

  async getLandlordTransfers(): Promise<LandlordTransfer[]> {
    return db.select().from(landlordTransfers).orderBy(desc(landlordTransfers.createdAt));
  }

  async getLandlordTransfer(id: string): Promise<LandlordTransfer | undefined> {
    const [transfer] = await db.select().from(landlordTransfers).where(eq(landlordTransfers.id, id));
    return transfer || undefined;
  }

  async createLandlordTransfer(data: InsertLandlordTransfer): Promise<LandlordTransfer> {
    const [transfer] = await db.insert(landlordTransfers).values(data).returning();
    return transfer;
  }

  async updateLandlordTransfer(id: string, data: Partial<InsertLandlordTransfer>): Promise<LandlordTransfer | undefined> {
    const [transfer] = await db.update(landlordTransfers).set(data).where(eq(landlordTransfers.id, id)).returning();
    return transfer || undefined;
  }

  async deleteLandlordTransfer(id: string): Promise<void> {
    await db.delete(landlordTransfers).where(eq(landlordTransfers.id, id));
  }

  async getInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
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
}

export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
