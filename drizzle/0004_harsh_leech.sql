CREATE TABLE `learner_event_versions` (
	`user_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`stream` text NOT NULL,
	`event_id` text NOT NULL,
	`revision` integer NOT NULL,
	`position` integer NOT NULL,
	`data` text NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `branch_id`, `stream`, `event_id`, `revision`)
);
--> statement-breakpoint
CREATE INDEX `learner_events_revision` ON `learner_event_versions` (`user_id`,`branch_id`,`revision`);