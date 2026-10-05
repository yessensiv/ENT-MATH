import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

// One independent aggregate per authenticated learner. Revisions prevent lost updates.
export const learnerStates = sqliteTable("learner_states", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  data: text("data").notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export const learnerStateChunks = sqliteTable("learner_state_chunks", {
  userId: text("user_id").notNull(),
  token: text("token").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  data: text("data").notNull(),
}, table => [primaryKey({ columns: [table.userId, table.token, table.chunkIndex] })]);

export const contentOverrides = sqliteTable("content_overrides", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("draft"),
  data: text("data").notNull(),
  history: text("history").notNull().default("[]"),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const contentReports = sqliteTable("content_reports", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  taskId: text("task_id").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("review"),
  createdAt: text("created_at").notNull(),
});

export const tutorUsage = sqliteTable("tutor_usage", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  day: text("day").notNull(),
  requests: integer("requests").notNull().default(0),
});
