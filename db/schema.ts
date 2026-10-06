import { sqliteTable, text, integer, primaryKey,index,uniqueIndex } from "drizzle-orm/sqlite-core";
import {sql} from 'drizzle-orm';

// Immutable revisions. Aggregates and backups choose an exact history revision.
export const learnerEventVersions=sqliteTable('learner_event_versions',{
 userId:text('user_id').notNull(),branchId:text('branch_id').notNull(),stream:text('stream').notNull(),eventId:text('event_id').notNull(),revision:integer('revision').notNull(),position:integer('position').notNull(),data:text('data').notNull(),deleted:integer('deleted').notNull().default(0),
},t=>[primaryKey({columns:[t.userId,t.branchId,t.stream,t.eventId,t.revision]}),index('learner_events_revision').on(t.userId,t.branchId,t.revision)]);

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
  reservedTokens: integer("reserved_tokens").notNull().default(0),
});

export const supportInvites = sqliteTable("support_invites", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(),
  ownerName: text("owner_name").notNull(), role: text("role").notNull(),
  tokenHash: text("token_hash").notNull().unique(), expiresAt: text("expires_at").notNull(),
  usedBy: text("used_by"), createdAt: text("created_at").notNull(),
},t=>[index('support_invites_owner_date').on(t.ownerId,t.createdAt)]);
export const supportLinks = sqliteTable("support_links", {
  id: text("id").primaryKey(), learnerId: text("learner_id").notNull(), observerId: text("observer_id").notNull(),
  observerName: text("observer_name").notNull(), role: text("role").notNull(), acceptedAt: text("accepted_at").notNull(), revokedAt: text("revoked_at"),
},t=>[index('support_links_learner').on(t.learnerId,t.revokedAt),index('support_links_observer').on(t.observerId,t.revokedAt),uniqueIndex('support_links_active_pair').on(t.learnerId,t.observerId,t.role).where(sql`${t.revokedAt} IS NULL`)]);
export const studyAssignments = sqliteTable("study_assignments", {
  id: text("id").primaryKey(), linkId: text("link_id").notNull(), topicId: text("topic_id").notNull(),
  title: text("title").notNull(), count: integer("count").notNull(), due: text("due").notNull(), createdAt: text("created_at").notNull(),
},t=>[index('study_assignments_link_date').on(t.linkId,t.createdAt)]);
export const learnerBackups = sqliteTable("learner_backups", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), head: text("head").notNull(),
  revision: integer("revision").notNull(), createdAt: text("created_at").notNull(),
},t=>[index('learner_backups_user_date').on(t.userId,t.createdAt)]);
export const learnerBackupChunks = sqliteTable("learner_backup_chunks", {
  backupId: text("backup_id").notNull(), chunkIndex: integer("chunk_index").notNull(), data: text("data").notNull(),
}, table => [primaryKey({columns:[table.backupId,table.chunkIndex]})]);
export const serviceIssues = sqliteTable("service_issues", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), code: text("code").notNull(),
  page: text("page").notNull(), createdAt: text("created_at").notNull(),
},t=>[index('service_issues_user_date').on(t.userId,t.createdAt),index('service_issues_date').on(t.createdAt)]);
export const editorialReviews = sqliteTable("editorial_reviews", {
  id: text("id").primaryKey(), materialId: text("material_id").notNull(), discipline: text("discipline").notNull(),
  verdict: text("verdict").notNull(), note: text("note").notNull(), reviewerId: text("reviewer_id").notNull(), createdAt: text("created_at").notNull(),
},t=>[index('editorial_reviews_material').on(t.materialId,t.createdAt)]);
