import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("homeowner"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

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
  contractorName: text("contractor_name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  message: text("message").notNull().default(""),
  availableAt: text("available_at").notNull().default(""),
  status: text("status").notNull().default("submitted"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("quotes_job_idx").on(table.jobId)]);

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
