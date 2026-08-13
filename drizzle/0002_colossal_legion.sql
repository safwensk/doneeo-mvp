CREATE TABLE `work_order_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `work_order_stops` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`stop_order` integer NOT NULL,
	`stop_type` text NOT NULL,
	`address` text NOT NULL,
	`actions_json` text DEFAULT '[]' NOT NULL,
	`access_json` text DEFAULT '{}' NOT NULL,
	`contact_name` text,
	`estimated_minutes` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_order_stop_order_idx` ON `work_order_stops` (`work_order_id`,`stop_order`);