CREATE TABLE `help_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `help_tickets_user_date` ON `help_tickets` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `help_tickets_status_date` ON `help_tickets` (`status`,`updated_at`);