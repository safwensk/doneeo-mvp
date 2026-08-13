CREATE TABLE `assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`executor_id` text NOT NULL,
	`role` text NOT NULL,
	`is_lead` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'offered' NOT NULL,
	`offered_at` text NOT NULL,
	`responded_at` text,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`executor_id`) REFERENCES `executors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignment_order_executor_idx` ON `assignments` (`work_order_id`,`executor_id`);--> statement-breakpoint
CREATE TABLE `equipment_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `executor_equipment` (
	`executor_id` text NOT NULL,
	`equipment_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`verified` integer DEFAULT true NOT NULL,
	PRIMARY KEY(`executor_id`, `equipment_id`),
	FOREIGN KEY (`executor_id`) REFERENCES `executors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment_catalog`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `executor_skills` (
	`executor_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`level` text NOT NULL,
	PRIMARY KEY(`executor_id`, `skill_id`),
	FOREIGN KEY (`executor_id`) REFERENCES `executors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `executors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`profile_type` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`rating` real NOT NULL,
	`completed_jobs` integer DEFAULT 0 NOT NULL,
	`location` text NOT NULL,
	`service_radius_km` integer DEFAULT 20 NOT NULL,
	`team_size` integer DEFAULT 1 NOT NULL,
	`lead_eligible` integer DEFAULT false NOT NULL,
	`vehicle` text,
	`hourly_rate` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rental_inventory` (
	`partner_id` text NOT NULL,
	`equipment_id` text NOT NULL,
	`quantity_available` integer DEFAULT 0 NOT NULL,
	`daily_price` integer NOT NULL,
	`deposit` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`partner_id`, `equipment_id`),
	FOREIGN KEY (`partner_id`) REFERENCES `rental_partners`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment_catalog`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rental_partners` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`pickup_lead_minutes` integer DEFAULT 20 NOT NULL,
	`delivery_available` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rental_reservations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`partner_id` text NOT NULL,
	`equipment_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price` integer NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`pickup_by_executor_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partner_id`) REFERENCES `rental_partners`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment_catalog`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pickup_by_executor_id`) REFERENCES `executors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`regulated` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_reference` text NOT NULL,
	`request_text` text NOT NULL,
	`category` text NOT NULL,
	`city` text DEFAULT 'Montréal' NOT NULL,
	`pickup_address` text,
	`delivery_address` text,
	`schedule_text` text,
	`selected_plan` text,
	`required_team_size` integer DEFAULT 1 NOT NULL,
	`required_skills_json` text DEFAULT '[]' NOT NULL,
	`required_equipment_json` text DEFAULT '[]' NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'matching' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_orders_public_reference_unique` ON `work_orders` (`public_reference`);