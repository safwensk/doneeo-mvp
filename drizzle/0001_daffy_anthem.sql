CREATE TABLE `equipment_responses` (
	`work_order_id` integer NOT NULL,
	`executor_id` text NOT NULL,
	`equipment_id` text NOT NULL,
	`profile_listed` integer DEFAULT false NOT NULL,
	`response` text DEFAULT 'pending' NOT NULL,
	`responded_at` text,
	PRIMARY KEY(`work_order_id`, `executor_id`, `equipment_id`),
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`executor_id`) REFERENCES `executors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment_catalog`(`id`) ON UPDATE no action ON DELETE no action
);
