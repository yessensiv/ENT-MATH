CREATE TABLE `editorial_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`material_id` text NOT NULL,
	`discipline` text NOT NULL,
	`verdict` text NOT NULL,
	`note` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learner_backup_chunks` (
	`backup_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`backup_id`, `chunk_index`)
);
--> statement-breakpoint
CREATE TABLE `learner_backups` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`head` text NOT NULL,
	`revision` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `service_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code` text NOT NULL,
	`page` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `study_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`title` text NOT NULL,
	`count` integer NOT NULL,
	`due` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `support_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`owner_name` text NOT NULL,
	`role` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `support_invites_token_hash_unique` ON `support_invites` (`token_hash`);--> statement-breakpoint
CREATE TABLE `support_links` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_id` text NOT NULL,
	`observer_id` text NOT NULL,
	`observer_name` text NOT NULL,
	`role` text NOT NULL,
	`accepted_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
ALTER TABLE `tutor_usage` ADD `reserved_tokens` integer DEFAULT 0 NOT NULL;