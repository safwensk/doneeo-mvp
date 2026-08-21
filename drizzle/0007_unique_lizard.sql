ALTER TABLE `work_cases` ADD `current_layer_id` text DEFAULT 'L01' NOT NULL;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `work_case_id` text REFERENCES work_cases(work_case_id);--> statement-breakpoint
ALTER TABLE `work_orders` ADD `job_order_id` text;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `requirement_contract_ref` text;--> statement-breakpoint
CREATE UNIQUE INDEX `work_orders_work_case_unique` ON `work_orders` (`work_case_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_orders_job_order_unique` ON `work_orders` (`job_order_id`);