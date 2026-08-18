CREATE TABLE `intelligence_requests` (
	`work_case_id` text PRIMARY KEY NOT NULL,
	`raw_request` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`work_case_id`) REFERENCES `work_cases`(`work_case_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `intelligence_task_identities` (
	`work_case_id` text NOT NULL,
	`task_id` text NOT NULL,
	`semantic_key` text NOT NULL,
	`ordinal` integer NOT NULL,
	`title` text NOT NULL,
	`domain` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`work_case_id`, `task_id`),
	FOREIGN KEY (`work_case_id`) REFERENCES `work_cases`(`work_case_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intelligence_task_active_semantic_key_idx` ON `intelligence_task_identities` (`work_case_id`,`semantic_key`) WHERE "intelligence_task_identities"."status" = 'ACTIVE';--> statement-breakpoint
CREATE TABLE `work_cases` (
	`work_case_id` text PRIMARY KEY NOT NULL,
	`job_order_id` text NOT NULL,
	`state` text NOT NULL,
	`state_version` integer NOT NULL,
	`current_requirement_ref` text,
	`current_fulfillment_ref` text,
	`current_execution_ref` text,
	`current_outcome_ref` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_cases_job_order_unique` ON `work_cases` (`job_order_id`);--> statement-breakpoint
ALTER TABLE `task_block_identities` ADD `acceptance_fingerprint` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `requirement_contract_single_current_idx` ON `requirement_contracts` (`contract_id`) WHERE "requirement_contracts"."status" = 'PUBLISHED';