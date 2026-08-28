CREATE TABLE `adjustment_instructions` (
	`instruction_id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`job_order_id` text NOT NULL,
	`protected_provider_minutes` integer DEFAULT 0 NOT NULL,
	`customer_adjustment_minutes` integer DEFAULT 0 NOT NULL,
	`doneeo_absorption_minutes` integer DEFAULT 0 NOT NULL,
	`recovery_credit_minutes` integer DEFAULT 0 NOT NULL,
	`by_role_json` text DEFAULT '{}' NOT NULL,
	`allocations_json` text DEFAULT '[]' NOT NULL,
	`external_cost_refs_json` text DEFAULT '[]' NOT NULL,
	`issued_at` text NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `responsibility_assessments`(`assessment_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `capacity_reservations` (
	`reservation_id` text PRIMARY KEY NOT NULL,
	`job_order_id` text NOT NULL,
	`role` text NOT NULL,
	`assignee_ref` text NOT NULL,
	`minutes_reserved` integer NOT NULL,
	`minutes_reallocated` integer DEFAULT 0 NOT NULL,
	`starts_at` text NOT NULL,
	`status` text DEFAULT 'HELD' NOT NULL,
	FOREIGN KEY (`job_order_id`) REFERENCES `commitments`(`job_order_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `changed_facts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reality_case_id` text NOT NULL,
	`fact_key` text NOT NULL,
	`superseded_value` text,
	`new_value` text NOT NULL,
	`source` text NOT NULL,
	`evidence_refs_json` text DEFAULT '[]' NOT NULL,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`reality_case_id`) REFERENCES `reality_cases`(`reality_case_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `commitments` (
	`job_order_id` text PRIMARY KEY NOT NULL,
	`work_case_id` text,
	`policy_name` text NOT NULL,
	`provider_accepted` integer DEFAULT false NOT NULL,
	`mobilization_started_at` text,
	`work_started_at` text,
	`frozen_at` text,
	`state_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`work_case_id`) REFERENCES `work_cases`(`work_case_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `field_observations` (
	`observation_id` text PRIMARY KEY NOT NULL,
	`reality_case_id` text NOT NULL,
	`task_id` text NOT NULL,
	`observed_at` text NOT NULL,
	`observed_by` text NOT NULL,
	`statement` text NOT NULL,
	`evidence_refs_json` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`reality_case_id`) REFERENCES `reality_cases`(`reality_case_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `impact_classifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reality_case_id` text NOT NULL,
	`task_id` text NOT NULL,
	`impact` text NOT NULL,
	`rationale` text NOT NULL,
	`needs_human_review` integer DEFAULT false NOT NULL,
	`classifier_name` text NOT NULL,
	`classified_at` text NOT NULL,
	FOREIGN KEY (`reality_case_id`) REFERENCES `reality_cases`(`reality_case_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `preparation_records` (
	`reservation_id` text PRIMARY KEY NOT NULL,
	`preparation_minutes` integer DEFAULT 0 NOT NULL,
	`mobilization_minutes` integer DEFAULT 0 NOT NULL,
	`external_cost_refs_json` text DEFAULT '[]' NOT NULL,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`reservation_id`) REFERENCES `capacity_reservations`(`reservation_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reality_cases` (
	`reality_case_id` text PRIMARY KEY NOT NULL,
	`work_case_id` text NOT NULL,
	`job_order_id` text NOT NULL,
	`opened_at` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`held_task_ids_json` text DEFAULT '[]' NOT NULL,
	`state_version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`work_case_id`) REFERENCES `work_cases`(`work_case_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recovery_decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reality_case_id` text NOT NULL,
	`selected_kind` text,
	`considered_json` text DEFAULT '[]' NOT NULL,
	`route_to_json` text DEFAULT '[]' NOT NULL,
	`continuing_task_ids_json` text DEFAULT '[]' NOT NULL,
	`unrecoverable` integer DEFAULT false NOT NULL,
	`needs_customer_approval` integer DEFAULT false NOT NULL,
	`decided_at` text NOT NULL,
	FOREIGN KEY (`reality_case_id`) REFERENCES `reality_cases`(`reality_case_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `responsibility_assessments` (
	`assessment_id` text PRIMARY KEY NOT NULL,
	`reality_case_id` text,
	`job_order_id` text NOT NULL,
	`cause` text NOT NULL,
	`customer_established` integer NOT NULL,
	`provider_established` integer NOT NULL,
	`doneeo_established` integer NOT NULL,
	`reasoning_json` text DEFAULT '{}' NOT NULL,
	`requires_review` integer DEFAULT false NOT NULL,
	`review_reason` text,
	`evidence_refs_json` text DEFAULT '[]' NOT NULL,
	`policy_name` text NOT NULL,
	`assessed_at` text NOT NULL,
	FOREIGN KEY (`reality_case_id`) REFERENCES `reality_cases`(`reality_case_id`) ON UPDATE no action ON DELETE no action
);
