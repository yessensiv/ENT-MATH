CREATE TABLE `learner_state_chunks` (
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`user_id`, `token`, `chunk_index`)
);
