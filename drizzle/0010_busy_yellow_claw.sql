CREATE TABLE `ledger_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaction_id` text NOT NULL,
	`account` text NOT NULL,
	`direction` text NOT NULL,
	`amount_minor_units` integer NOT NULL,
	`currency` text DEFAULT 'CAD' NOT NULL,
	`narrative` text NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `ledger_transactions`(`transaction_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ledger_transactions` (
	`transaction_id` text PRIMARY KEY NOT NULL,
	`job_order_id` text NOT NULL,
	`kind` text NOT NULL,
	`reverses` text,
	`source_ref` text NOT NULL,
	`posted_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payment_authorizations` (
	`authorization_id` text PRIMARY KEY NOT NULL,
	`job_order_id` text NOT NULL,
	`authorized_minor_units` integer NOT NULL,
	`captured_minor_units` integer DEFAULT 0 NOT NULL,
	`released_minor_units` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'CAD' NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`psp_ref` text NOT NULL,
	`authorized_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settlements` (
	`job_order_id` text PRIMARY KEY NOT NULL,
	`transaction_id` text,
	`customer_total_minor_units` integer DEFAULT 0 NOT NULL,
	`provider_total_minor_units` integer DEFAULT 0 NOT NULL,
	`doneeo_position_minor_units` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'CAD' NOT NULL,
	`nothing_owed` integer DEFAULT false NOT NULL,
	`rate_policy_name` text NOT NULL,
	`calculated_at` text NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `ledger_transactions`(`transaction_id`) ON UPDATE no action ON DELETE no action
);
