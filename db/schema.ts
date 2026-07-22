import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("homeowner"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const contractorProfiles = sqliteTable("contractor_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerEmail: text("owner_email").notNull(),
  businessName: text("business_name").notNull(),
  legalName: text("legal_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  about: text("about").notNull().default(""),
  primaryService: text("primary_service").notNull(),
  services: text("services").notNull().default("[]"),
  homeBase: text("home_base").notNull().default("Hamilton, Ontario"),
  serviceRadiusKm: integer("service_radius_km").notNull().default(30),
  teamSize: integer("team_size").notNull().default(1),
  emergencyAvailable: integer("emergency_available", { mode: "boolean" }).notNull().default(false),
  acceptingWork: integer("accepting_work", { mode: "boolean" }).notNull().default(true),
  plan: text("plan").notNull().default("growth"),
  verificationStatus: text("verification_status").notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [uniqueIndex("contractor_profiles_owner_unique").on(table.ownerEmail)]);

export const jobRequests = sqliteTable("job_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalId: text("external_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  size: text("size").notNull().default("Not specified"),
  timeline: text("timeline").notNull().default("Flexible"),
  budget: text("budget").notNull().default("Need guidance"),
  postalCode: text("postal_code").notNull().default(""),
  emergency: integer("emergency", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("matching"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("job_requests_external_id_unique").on(table.externalId),
  index("job_requests_owner_created_idx").on(table.ownerEmail, table.createdAt),
  index("job_requests_status_idx").on(table.status),
]);

export const quotes = sqliteTable("quotes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").notNull().references(() => jobRequests.id, { onDelete: "cascade" }),
  contractorEmail: text("contractor_email"),
  contractorName: text("contractor_name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  message: text("message").notNull().default(""),
  availableAt: text("available_at").notNull().default(""),
  status: text("status").notNull().default("submitted"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("quotes_job_idx").on(table.jobId),
  uniqueIndex("quotes_job_contractor_unique").on(table.jobId, table.contractorEmail),
]);

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").notNull().references(() => jobRequests.id, { onDelete: "cascade" }),
  senderEmail: text("sender_email").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("messages_job_created_idx").on(table.jobId, table.createdAt)]);

export const jobEvents = sqliteTable("job_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").notNull().references(() => jobRequests.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  label: text("label").notNull(),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("job_events_job_created_idx").on(table.jobId, table.createdAt)]);

export const paymentRecords = sqliteTable("payment_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").notNull().references(() => jobRequests.id, { onDelete: "cascade" }),
  quoteId: integer("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  ownerEmail: text("owner_email").notNull(),
  contractorEmail: text("contractor_email"),
  contractorName: text("contractor_name").notNull(),
  subtotalCents: integer("subtotal_cents").notNull(),
  customerFeeCents: integer("customer_fee_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  contractorPayoutCents: integer("contractor_payout_cents").notNull(),
  currency: text("currency").notNull().default("cad"),
  status: text("status").notNull().default("processor_setup_required"),
  processor: text("processor").notNull().default("unconfigured"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("payment_records_job_unique").on(table.jobId),
  index("payment_records_owner_idx").on(table.ownerEmail),
  index("payment_records_contractor_idx").on(table.contractorEmail),
]);

export const documentRecords = sqliteTable("document_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalId: text("external_id").notNull(),
  jobId: integer("job_id").notNull().references(() => jobRequests.id, { onDelete: "cascade" }),
  quoteId: integer("quote_id").references(() => quotes.id, { onDelete: "set null" }),
  ownerEmail: text("owner_email").notNull(),
  contractorEmail: text("contractor_email"),
  documentType: text("document_type").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("generated"),
  content: text("content").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("document_records_external_unique").on(table.externalId),
  uniqueIndex("document_records_job_type_unique").on(table.jobId, table.documentType),
  index("document_records_owner_idx").on(table.ownerEmail),
  index("document_records_contractor_idx").on(table.contractorEmail),
]);

export const changeOrders = sqliteTable("change_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalId: text("external_id").notNull(),
  jobId: integer("job_id").notNull().references(() => jobRequests.id, { onDelete: "cascade" }),
  quoteId: integer("quote_id").references(() => quotes.id, { onDelete: "set null" }),
  ownerEmail: text("owner_email").notNull(),
  contractorEmail: text("contractor_email").notNull(),
  contractorName: text("contractor_name").notNull(),
  reason: text("reason").notNull(),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  scheduleImpact: text("schedule_impact").notNull().default("No schedule impact"),
  status: text("status").notNull().default("pending"),
  decisionName: text("decision_name"),
  decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("change_orders_external_unique").on(table.externalId),
  index("change_orders_job_idx").on(table.jobId),
  index("change_orders_owner_idx").on(table.ownerEmail),
  index("change_orders_contractor_idx").on(table.contractorEmail),
]);

export const verifiedReviews = sqliteTable("verified_reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").notNull().references(() => jobRequests.id, { onDelete: "cascade" }),
  ownerEmail: text("owner_email").notNull(),
  contractorEmail: text("contractor_email").notNull(),
  contractorName: text("contractor_name").notNull(),
  workmanship: integer("workmanship").notNull(),
  communication: integer("communication").notNull(),
  punctuality: integer("punctuality").notNull(),
  cleanliness: integer("cleanliness").notNull(),
  averageScore: integer("average_score").notNull(),
  comment: text("comment").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("verified_reviews_job_unique").on(table.jobId),
  index("verified_reviews_contractor_idx").on(table.contractorEmail),
]);

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recipientEmail: text("recipient_email").notNull(),
  jobId: integer("job_id").references(() => jobRequests.id, { onDelete: "cascade" }),
  notificationType: text("notification_type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  readAt: integer("read_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("notifications_recipient_created_idx").on(table.recipientEmail, table.createdAt)]);

export const supportRequests = sqliteTable("support_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalId: text("external_id").notNull(),
  requesterEmail: text("requester_email").notNull(),
  jobExternalId: text("job_external_id").notNull().default(""),
  topic: text("topic").notNull().default("general"),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("normal"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("support_requests_external_unique").on(table.externalId),
  index("support_requests_requester_created_idx").on(table.requesterEmail, table.createdAt),
  index("support_requests_status_created_idx").on(table.status, table.createdAt),
]);

export const jobAttachments = sqliteTable("job_attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").notNull().references(() => jobRequests.id, { onDelete: "cascade" }),
  ownerEmail: text("owner_email").notNull(),
  storageKey: text("storage_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  kind: text("kind").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("job_attachments_storage_key_unique").on(table.storageKey),
  index("job_attachments_job_created_idx").on(table.jobId, table.createdAt),
  index("job_attachments_owner_idx").on(table.ownerEmail),
]);
