import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, date, timestamp, pgEnum, uniqueIndex, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);
export const contractStatusEnum = pgEnum("contract_status", ["active", "inactive", "terminated"]);
export const receiptStatusEnum = pgEnum("receipt_status", ["draft", "closed", "paid", "transferred", "NF_GERADA", "NF_EMITIDA", "BOLETO_EMITIDO"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["IN", "OUT"]);
export const transferStatusEnum = pgEnum("transfer_status", ["pending", "paid", "failed", "reversed"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "issued", "error", "cancelled"]);
export const pixKeyTypeEnum = pgEnum("pix_key_type", ["cpf", "cnpj", "email", "phone", "random"]);
export const nfseStatusEnum = pgEnum("nfse_status", ["PENDENTE", "ENVIANDO", "EMITIDA", "FALHOU", "CANCELADA"]);
export const nfseLoteStatusEnum = pgEnum("nfse_lote_status", ["CRIADO", "VALIDADO", "PROCESSANDO", "FINALIZADO", "FINALIZADO_COM_FALHAS"]);
export const clientTypeEnum = pgEnum("client_type", ["consultoria", "sistema"]);
export const paymentTypeEnum = pgEnum("payment_type", ["hourly", "fixed"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Empresas (Antigo Landlords)
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Razão Social
  tradeName: text("trade_name"), // Nome Fantasia
  doc: text("doc").notNull(), // CNPJ
  address: text("address"),
  street: text("street"),
  number: text("number"),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  phone: text("phone"),
  email: text("email"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  bank: text("bank"),
  branch: text("branch"),
  account: text("account"),
  pixKeyType: pixKeyTypeEnum("pix_key_type"),
  pixKey: text("pix_key"),
  
  // Configuração Banco Inter (Boleto)
  interClientId: text("inter_client_id"),
  interClientSecret: text("inter_client_secret"),
  interCertPath: text("inter_cert_path"),
  interKeyPath: text("inter_key_path"),
  interEnvironment: text("inter_environment").default("sandbox"), // sandbox | production

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Clientes (Antigo Tenants)
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  doc: text("doc").notNull(), // CPF/CNPJ
  address: text("address"), // Deprecated: use street, number, etc.
  street: text("street"),
  number: text("number"),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  phone: text("phone"),
  email: text("email"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  type: clientTypeEnum("type").default("consultoria").notNull(),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Analistas (Antigo ServiceProviders)
export const analysts = pgTable("analysts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role"), // Cargo/Função
  paymentType: paymentTypeEnum("payment_type").default("hourly").notNull(),
  fixedValue: decimal("fixed_value", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  clientType: text("client_type").default("client").notNull(), // client or partner
  clientId: varchar("client_id").references(() => clients.id),
  partnerId: varchar("partner_id").references(() => partners.id),
  supplierId: varchar("supplier_id").references(() => partners.id), // Parceiro fornecedor (quem executa)
  endClientId: varchar("end_client_id").references(() => clients.id), // Cliente final quando o pagador é um parceiro
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }), // Valor hora a receber
  supplierHourlyRate: decimal("supplier_hourly_rate", { precision: 10, scale: 2 }), // Valor hora a pagar
  isBillable: boolean("is_billable").default(true).notNull(), // Indica se o projeto fatura
  active: boolean("active").default(true).notNull(),
  billingEmails: text("billing_emails"), // Emails para cobrança (separados por vírgula)
  responsibleContact: text("responsible_contact"), // Contato responsável
  serviceCatalogId: varchar("service_catalog_id").references(() => serviceCatalog.id), // Link ao catálogo
  dayDue: integer("day_due"), // Dia de vencimento
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectAnalysts = pgTable("project_analysts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  analystId: varchar("analyst_id").references(() => analysts.id).notNull(),
  role: text("role"), // Papel do analista neste projeto específico
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }), // Valor hora do analista neste projeto (Receber)
  costRate: decimal("cost_rate", { precision: 10, scale: 2 }), // Valor hora do analista neste projeto (Pagar)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectPartners = pgTable("project_partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  partnerId: varchar("partner_id").references(() => partners.id).notNull(),
  role: text("role"), // Papel do parceiro neste projeto específico
  value: decimal("value", { precision: 10, scale: 2 }), // Valor a ser pago ao parceiro
  valueType: text("value_type").default("hour"), // hour (por hora) ou fixed (fixo)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const partners = pgTable("partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  cnpj: text("cnpj").notNull(),
  address: text("address"), // Deprecated
  street: text("street"),
  number: text("number"),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Catálogo de Serviços
export const serviceCatalog = pgTable("service_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  nationalTaxationCode: text("national_taxation_code"), // Código de Tributação Nacional
  nbsCode: text("nbs_code"), // Item da NBS correspondente ao serviço prestado
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Contratos de Prestação de Serviços
export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id).notNull(), // Empresa prestadora
  clientId: varchar("client_id").references(() => clients.id).notNull(), // Cliente tomador
  description: text("description").notNull(), // Descrição do contrato
  startDate: date("start_date").notNull(),
  endDate: date("end_date"), // Pode ser indeterminado
  dayDue: integer("day_due").notNull(), // Dia de vencimento
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Valor mensal
  status: contractStatusEnum("status").default("active").notNull(),
  billingEmails: text("billing_emails"), // Emails para cobrança (separados por vírgula)
  responsibleContact: text("responsible_contact"), // Contato responsável
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Itens/Serviços Adicionais no Contrato (ou execuções pontuais)
export const contractItems = pgTable("contract_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").references(() => contracts.id).notNull(),
  serviceCatalogId: varchar("service_catalog_id").references(() => serviceCatalog.id), // Link opcional ao catálogo
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  refYear: integer("ref_year").notNull(),
  refMonth: integer("ref_month").notNull(),
  chargedTo: text("charged_to").default("CLIENT").notNull(), // CLIENT or COMPANY
  analystId: varchar("analyst_id").references(() => analysts.id),
  passThrough: boolean("pass_through").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const receipts = pgTable("receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").references(() => contracts.id),
  projectId: varchar("project_id").references(() => projects.id),
  systemContractId: varchar("system_contract_id").references(() => systemContracts.id),
  refYear: integer("ref_year").notNull(),
  refMonth: integer("ref_month").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Valor base do contrato ou projeto
  servicesAmount: decimal("services_amount", { precision: 10, scale: 2 }).default("0").notNull(), // Extras
  totalDue: decimal("total_due", { precision: 10, scale: 2 }).notNull(),
  status: receiptStatusEnum("status").default("draft").notNull(),
  isInvoiceGenerated: boolean("is_invoice_generated").default(false).notNull(),
  isInvoiceIssued: boolean("is_invoice_issued").default(false).notNull(),
  isInvoiceCancelled: boolean("is_invoice_cancelled").default(false).notNull(),
  
  // Campos Boleto Inter
  boletoSolicitacaoId: text("boleto_solicitacao_id"),
  boletoStatus: text("boleto_status").default("PENDING"), // PENDING, ISSUED, PAID, CANCELLED, ERROR
  boletoPdfUrl: text("boleto_pdf_url"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  contractRefUnique: uniqueIndex("receipts_contract_ref_unique").on(table.contractId, table.refYear, table.refMonth),
  projectRefUnique: uniqueIndex("receipts_project_ref_unique").on(table.projectId, table.refYear, table.refMonth),
  systemContractRefUnique: uniqueIndex("receipts_system_contract_ref_unique").on(table.systemContractId, table.refYear, table.refMonth),
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

// NFs (NFS-e)
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  receiptId: varchar("receipt_id").references(() => receipts.id).notNull(),
  companyId: varchar("company_id").references(() => companies.id), // Prestador (Opcional)
  clientId: varchar("client_id").references(() => clients.id), // Tomador (Opcional)
  providerName: text("provider_name"), // Nome do Prestador (para flexibilidade)
  providerDoc: text("provider_doc"), // CNPJ/CPF do Prestador
  borrowerName: text("borrower_name"), // Nome do Tomador (para flexibilidade)
  borrowerDoc: text("borrower_doc"), // CNPJ/CPF do Tomador
  number: text("number"), // Número da NF
  verificationCode: text("verification_code"), // Código de verificação
  status: nfseStatusEnum("status").default("PENDENTE").notNull(),
  issuedAt: timestamp("issued_at"),
  xmlUrl: text("xml_url"),
  pdfUrl: text("pdf_url"),
  errorMessage: text("error_message"),
  emailStatus: text("email_status").default("PENDING"), // PENDING, SENT, ERROR
  emailSentAt: timestamp("email_sent_at"),
  amount: decimal("amount", { precision: 10, scale: 2 }), // Valor da NF
  
  // Campos Boleto Inter
  boletoSolicitacaoId: text("boleto_solicitacao_id"),
  boletoStatus: text("boleto_status").default("PENDING"), // PENDING, ISSUED, PAID, CANCELLED, ERROR
  boletoPdfUrl: text("boleto_pdf_url"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Configuração NFS-e (Tatuí)
export const nfseConfigs = pgTable("nfse_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id), // Vinculado a uma empresa
  cidade: text("cidade").default("Tatuí").notNull(),
  ambiente: text("ambiente").default("homologacao").notNull(), // homologacao, producao
  login: text("login"),
  senha: text("senha"), // Senha do portal
  token: text("token"),
  clientSecret: text("client_secret"), // Para API se necessário
  itemServico: text("item_servico").default("11.01"),
  serieNfse: text("serie_nfse").default("900"),
  certificado: text("certificado"), // Caminho do arquivo PFX/P12
  certificadoSenha: text("certificado_senha"), // Senha do certificado
  
  // Campos adicionais para emissão
  cnpjPrestador: text("cnpj_prestador"),
  inscricaoMunicipal: text("inscricao_municipal"),
  codigoMunicipioIbge: text("codigo_municipio_ibge"),
  regimeTributario: text("regime_tributario"),
  cnae: text("cnae"),
  descricaoServicoPadrao: text("descricao_servico_padrao"),
  aliquotaIss: decimal("aliquota_iss", { precision: 5, scale: 2 }),
  issRetido: boolean("iss_retido").default(false),
  ultimoNumeroNfse: integer("ultimo_numero_nfse").default(0),
  
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("nfse_configs_company_idx").on(table.companyId),
}));

export const nfseLotes = pgTable("nfse_lotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: nfseLoteStatusEnum("status").default("CRIADO").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const nfseEmissoes = pgTable("nfse_emissoes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loteId: varchar("lote_id").references(() => nfseLotes.id),
  origemId: text("origem_id").notNull(), // ID da Invoice
  origemTipo: text("origem_tipo").default("INVOICE").notNull(),
  status: nfseStatusEnum("status").default("PENDENTE").notNull(),
  numero: text("numero"),
  chaveAcesso: text("chave_acesso"),
  codigoVerificacao: text("codigo_verificacao"),
  linkUrl: text("link_url"),
  xmlUrl: text("xml_url"),
  error: text("error"),
  valor: decimal("valor", { precision: 10, scale: 2 }),
  tomadorNome: text("tomador_nome"),
  tomadorCpfCnpj: text("tomador_cpf_cnpj"),
  discriminacao: text("discriminacao"),
  apiRequestRaw: text("api_request_raw"),
  apiResponseRaw: text("api_response_raw"),
  cancelamentoXmlRequest: text("cancelamento_xml_request"),
  cancelamentoXmlResponse: text("cancelamento_xml_response"),
  retryCount: integer("retry_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const timesheetEntries = pgTable("timesheet_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  receiptId: varchar("receipt_id").references(() => receipts.id).notNull(),
  analystId: varchar("analyst_id").references(() => analysts.id), // Nullable if it's a partner
  partnerId: varchar("partner_id").references(() => partners.id), // Nullable if it's an analyst
  hours: decimal("hours", { precision: 10, scale: 4 }).notNull(),
  
  // Snapshot of rates
  costRate: decimal("cost_rate", { precision: 10, scale: 2 }).default("0").notNull(), // Valor a pagar (Analista/Parceiro)
  billableRate: decimal("billable_rate", { precision: 10, scale: 2 }).default("0").notNull(), // Valor a cobrar (Projeto)
  
  analystPaymentType: varchar("analyst_payment_type", { length: 20 }).default("hour"), // 'hour' | 'fixed'

  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Contratos de Sistemas
export const systemContracts = pgTable("system_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(), // Legacy: manter até migração completa
  clientName: text("client_name").notNull(), // Legacy: manter até migração completa
  companyId: varchar("company_id").references(() => companies.id), // Nova referência para empresa
  clientId: varchar("client_id").references(() => clients.id), // Nova referência para cliente
  systemName: text("system_name").default("SimpleDFe").notNull(), // Qual o sistema
  monthlyValue: decimal("monthly_value", { precision: 10, scale: 2 }).notNull(), // Valor mensal
  startDate: date("start_date").notNull(), // Inicio do Contrato
  endDate: date("end_date"), // Final do Contrato
  active: boolean("active").default(true).notNull(), // Ativo ou não
  billingEmails: text("billing_emails"), // Emails para cobrança (separados por vírgula)
  responsibleContact: text("responsible_contact"), // Contato responsável
  serviceCatalogId: varchar("service_catalog_id").references(() => serviceCatalog.id), // Link ao catálogo
  dayDue: integer("day_due"), // Dia de vencimento
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const systemLogs = pgTable("system_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  level: text("level").notNull(), // INFO, WARN, ERROR
  category: text("category").notNull(), // NFSE, AUTH, etc
  message: text("message").notNull(),
  details: text("details"), // JSON string
  correlationId: text("correlation_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schemas Zod para validação
export const insertCompanySchema = createInsertSchema(companies).omit({
  createdAt: true,
  id: true
}).extend({
  name: z.string().min(1, "Razão Social é obrigatória"),
  doc: z.string().min(1, "CNPJ é obrigatório"),
  email: z.string().email("Email inválido").optional().nullable().or(z.literal("")),
  pixKeyType: z.preprocess((val) => val === "" ? null : val, z.enum(["cpf", "cnpj", "email", "phone", "random"]).optional().nullable()),
  interClientId: z.string().optional().nullable().or(z.literal("")),
  interClientSecret: z.string().optional().nullable().or(z.literal("")),
  interCertPath: z.string().optional().nullable().or(z.literal("")),
  interEnvironment: z.enum(["sandbox", "production"]).optional().default("sandbox"),
});
export const insertClientSchema = createInsertSchema(clients).omit({ createdAt: true, id: true });
export const insertAnalystSchema = createInsertSchema(analysts).omit({ createdAt: true, id: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ createdAt: true, id: true });
export const insertProjectAnalystSchema = createInsertSchema(projectAnalysts).omit({ createdAt: true, id: true });
export const insertProjectPartnerSchema = createInsertSchema(projectPartners).omit({ createdAt: true, id: true });
export const insertSystemContractSchema = createInsertSchema(systemContracts).omit({ createdAt: true, id: true });
export const insertPartnerSchema = createInsertSchema(partners).omit({ createdAt: true, id: true });
export const insertServiceCatalogSchema = createInsertSchema(serviceCatalog).omit({ createdAt: true, id: true });
export const insertContractSchema = createInsertSchema(contracts).omit({ createdAt: true, id: true });
export const insertContractItemSchema = createInsertSchema(contractItems).omit({ id: true });
export const insertReceiptSchema = createInsertSchema(receipts).omit({ createdAt: true, id: true });
export const insertCashTransactionSchema = createInsertSchema(cashTransactions).omit({ createdAt: true, id: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ createdAt: true, id: true });
export const insertNfseConfigSchema = createInsertSchema(nfseConfigs).omit({ 
  id: true, 
  updatedAt: true 
}).extend({
  // Campos opcionais para facilitar o form
  cnpjPrestador: z.string().optional(),
  inscricaoMunicipal: z.string().optional(),
  codigoMunicipioIbge: z.string().optional(),
  regimeTributario: z.string().optional(),
  cnae: z.string().optional(),
  descricaoServicoPadrao: z.string().optional(),
  aliquotaIss: z.string().optional(),
  issRetido: z.boolean().optional(),
  ultimoNumeroNfse: z.number().optional(),
});
export const insertNfseLoteSchema = createInsertSchema(nfseLotes).omit({ createdAt: true, updatedAt: true, id: true });
export const insertNfseEmissaoSchema = createInsertSchema(nfseEmissoes).omit({ createdAt: true, updatedAt: true, id: true });
export const insertTimesheetEntrySchema = createInsertSchema(timesheetEntries).omit({ createdAt: true, id: true });
export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({ createdAt: true, id: true });

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

// Types
export type Company = typeof companies.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Analyst = typeof analysts.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectAnalyst = typeof projectAnalysts.$inferSelect;
export type ProjectPartner = typeof projectPartners.$inferSelect;
export type SystemContract = typeof systemContracts.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type ServiceCatalog = typeof serviceCatalog.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type ContractItem = typeof contractItems.$inferSelect;
export type Receipt = typeof receipts.$inferSelect;
export type CashTransaction = typeof cashTransactions.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type NfseConfig = typeof nfseConfigs.$inferSelect;
export type NfseLote = typeof nfseLotes.$inferSelect;
export type NfseEmissao = typeof nfseEmissoes.$inferSelect;
export type TimesheetEntry = typeof timesheetEntries.$inferSelect;
export type SystemLog = typeof systemLogs.$inferSelect;

export type InsertUser = typeof users.$inferInsert;
export type InsertCompany = typeof companies.$inferInsert;
export type InsertClient = typeof clients.$inferInsert;
export type InsertAnalyst = typeof analysts.$inferInsert;
export type InsertProject = typeof projects.$inferInsert;
export type InsertProjectAnalyst = typeof projectAnalysts.$inferInsert;
export type InsertProjectPartner = typeof projectPartners.$inferInsert;
export type InsertSystemContract = typeof systemContracts.$inferInsert;
export type InsertPartner = typeof partners.$inferInsert;
export type InsertServiceCatalog = typeof serviceCatalog.$inferInsert;
export type InsertContract = typeof contracts.$inferInsert;
export type InsertSystemLog = typeof systemLogs.$inferInsert;
export type InsertContractItem = typeof contractItems.$inferInsert;
export type InsertReceipt = typeof receipts.$inferInsert;
export type InsertCashTransaction = typeof cashTransactions.$inferInsert;
export type InsertInvoice = typeof invoices.$inferInsert;
export type InsertNfseConfig = typeof nfseConfigs.$inferInsert;
export type InsertNfseLote = typeof nfseLotes.$inferInsert;
export type InsertNfseEmissao = typeof nfseEmissoes.$inferInsert;
export type InsertTimesheetEntry = typeof timesheetEntries.$inferInsert;
