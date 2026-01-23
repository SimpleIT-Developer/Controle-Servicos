import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, date, timestamp, pgEnum, uniqueIndex, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);
export const propertyStatusEnum = pgEnum("property_status", ["available", "rented", "maintenance"]);
export const contractStatusEnum = pgEnum("contract_status", ["active", "inactive", "terminated"]);
export const chargedToEnum = pgEnum("charged_to", ["TENANT", "LANDLORD"]);
export const receiptStatusEnum = pgEnum("receipt_status", ["draft", "closed", "paid", "transferred"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["IN", "OUT"]);
export const transferStatusEnum = pgEnum("transfer_status", ["pending", "paid", "failed", "reversed"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "issued", "error", "cancelled"]);
export const pixKeyTypeEnum = pgEnum("pix_key_type", ["cpf", "cnpj", "email", "phone", "random"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const landlords = pgTable("landlords", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  doc: text("doc").notNull(),
  email: text("email"),
  phone: text("phone"),
  pixKey: text("pix_key"),
  pixKeyType: pixKeyTypeEnum("pix_key_type"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  doc: text("doc").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const serviceProviders = pgTable("service_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  doc: text("doc"),
  email: text("email"),
  phone: text("phone"),
  serviceType: text("service_type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  rentDefault: decimal("rent_default", { precision: 10, scale: 2 }).notNull(),
  landlordId: varchar("landlord_id").references(() => landlords.id),
  status: propertyStatusEnum("status").default("available").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  landlordId: varchar("landlord_id").references(() => landlords.id).notNull(),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  firstDueDate: date("first_due_date"),
  dueDay: integer("due_day").notNull(),
  rentAmount: decimal("rent_amount", { precision: 10, scale: 2 }).notNull(),
  adminFeePercent: decimal("admin_fee_percent", { precision: 5, scale: 2 }).notNull(),
  status: contractStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").references(() => contracts.id).notNull(),
  providerId: varchar("provider_id").references(() => serviceProviders.id),
  refYear: integer("ref_year").notNull(),
  refMonth: integer("ref_month").notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  chargedTo: chargedToEnum("charged_to").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  contractRefIdx: index("services_contract_ref_idx").on(table.contractId, table.refYear, table.refMonth),
}));

export const receipts = pgTable("receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").references(() => contracts.id).notNull(),
  refYear: integer("ref_year").notNull(),
  refMonth: integer("ref_month").notNull(),
  rentAmount: decimal("rent_amount", { precision: 10, scale: 2 }).notNull(),
  adminFeePercent: decimal("admin_fee_percent", { precision: 5, scale: 2 }).notNull(),
  adminFeeAmount: decimal("admin_fee_amount", { precision: 10, scale: 2 }).notNull(),
  servicesTenantTotal: decimal("services_tenant_total", { precision: 10, scale: 2 }).default("0").notNull(),
  servicesLandlordTotal: decimal("services_landlord_total", { precision: 10, scale: 2 }).default("0").notNull(),
  tenantTotalDue: decimal("tenant_total_due", { precision: 10, scale: 2 }).notNull(),
  landlordTotalDue: decimal("landlord_total_due", { precision: 10, scale: 2 }).notNull(),
  status: receiptStatusEnum("status").default("draft").notNull(),
  isInvoiceIssued: boolean("is_invoice_issued").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  contractRefUnique: uniqueIndex("receipts_contract_ref_unique").on(table.contractId, table.refYear, table.refMonth),
}));

export const cashTransactions = pgTable("cash_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: transactionTypeEnum("type").notNull(),
  date: date("date").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  receiptId: varchar("receipt_id").references(() => receipts.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  receiptIdx: index("cash_transactions_receipt_idx").on(table.receiptId),
}));

export const landlordTransfers = pgTable("landlord_transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  landlordId: varchar("landlord_id").references(() => landlords.id).notNull(),
  receiptId: varchar("receipt_id").references(() => receipts.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: transferStatusEnum("status").default("pending").notNull(),
  providerTransferId: text("provider_transfer_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  landlordId: varchar("landlord_id").references(() => landlords.id).notNull(),
  receiptId: varchar("receipt_id").references(() => receipts.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: invoiceStatusEnum("status").default("draft").notNull(),
  providerInvoiceId: text("provider_invoice_id"),
  number: text("number"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const propertiesRelations = relations(properties, ({ one }) => ({
  landlord: one(landlords, {
    fields: [properties.landlordId],
    references: [landlords.id],
  }),
}));

export const contractsRelations = relations(contracts, ({ one }) => ({
  property: one(properties, {
    fields: [contracts.propertyId],
    references: [properties.id],
  }),
  landlord: one(landlords, {
    fields: [contracts.landlordId],
    references: [landlords.id],
  }),
  tenant: one(tenants, {
    fields: [contracts.tenantId],
    references: [tenants.id],
  }),
}));

export const servicesRelations = relations(services, ({ one }) => ({
  contract: one(contracts, {
    fields: [services.contractId],
    references: [contracts.id],
  }),
  provider: one(serviceProviders, {
    fields: [services.providerId],
    references: [serviceProviders.id],
  }),
}));

export const receiptsRelations = relations(receipts, ({ one }) => ({
  contract: one(contracts, {
    fields: [receipts.contractId],
    references: [contracts.id],
  }),
}));

export const cashTransactionsRelations = relations(cashTransactions, ({ one }) => ({
  receipt: one(receipts, {
    fields: [cashTransactions.receiptId],
    references: [receipts.id],
  }),
}));

export const landlordTransfersRelations = relations(landlordTransfers, ({ one }) => ({
  landlord: one(landlords, {
    fields: [landlordTransfers.landlordId],
    references: [landlords.id],
  }),
  receipt: one(receipts, {
    fields: [landlordTransfers.receiptId],
    references: [receipts.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  landlord: one(landlords, {
    fields: [invoices.landlordId],
    references: [landlords.id],
  }),
  receipt: one(receipts, {
    fields: [invoices.receiptId],
    references: [receipts.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertLandlordSchema = createInsertSchema(landlords).omit({ id: true, createdAt: true });
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });
export const insertServiceProviderSchema = createInsertSchema(serviceProviders).omit({ id: true, createdAt: true });
export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, createdAt: true });
export const insertContractSchema = createInsertSchema(contracts).omit({ id: true, createdAt: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true, createdAt: true });
export const insertReceiptSchema = createInsertSchema(receipts).omit({ id: true, createdAt: true });
export const insertCashTransactionSchema = createInsertSchema(cashTransactions).omit({ id: true, createdAt: true });
export const insertLandlordTransferSchema = createInsertSchema(landlordTransfers).omit({ id: true, createdAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertLandlord = z.infer<typeof insertLandlordSchema>;
export type Landlord = typeof landlords.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;
export type InsertServiceProvider = z.infer<typeof insertServiceProviderSchema>;
export type ServiceProvider = typeof serviceProviders.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receipts.$inferSelect;
export type InsertCashTransaction = z.infer<typeof insertCashTransactionSchema>;
export type CashTransaction = typeof cashTransactions.$inferSelect;
export type InsertLandlordTransfer = z.infer<typeof insertLandlordTransferSchema>;
export type LandlordTransfer = typeof landlordTransfers.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginInput = z.infer<typeof loginSchema>;
