CREATE INDEX `editorial_reviews_material` ON `editorial_reviews` (`material_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `learner_backups_user_date` ON `learner_backups` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `service_issues_user_date` ON `service_issues` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `service_issues_date` ON `service_issues` (`created_at`);--> statement-breakpoint
CREATE INDEX `study_assignments_link_date` ON `study_assignments` (`link_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `support_invites_owner_date` ON `support_invites` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `support_links_learner` ON `support_links` (`learner_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `support_links_observer` ON `support_links` (`observer_id`,`revoked_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `support_links_active_pair` ON `support_links` (`learner_id`,`observer_id`,`role`) WHERE "support_links"."revoked_at" IS NULL;