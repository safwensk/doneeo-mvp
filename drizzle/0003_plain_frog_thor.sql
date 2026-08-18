CREATE TABLE `command_log` (
	`command_key` text PRIMARY KEY NOT NULL,
	`command_type` text NOT NULL,
	`request_hash` text NOT NULL,
	`status` text NOT NULL,
	`result` text,
	`correlation_id` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `domain_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stream_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`correlation_id` text NOT NULL,
	`causation_id` text,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domain_events_stream_sequence` ON `domain_events` (`stream_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `requirement_contracts` (
	`contract_id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`published_at` text,
	`superseded_by` integer,
	`supersede_reason` text,
	`correlation_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`contract_id`, `version`)
);
--> statement-breakpoint
CREATE TABLE `task_block_identities` (
	`contract_id` text NOT NULL,
	`contract_version` integer NOT NULL,
	`requirement_id` text NOT NULL,
	`fulfillment_id` text,
	`execution_id` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`contract_id`, `contract_version`, `requirement_id`)
);
