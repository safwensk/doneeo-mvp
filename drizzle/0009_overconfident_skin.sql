CREATE TABLE `commercial_offers` (
	`offer_id` text PRIMARY KEY NOT NULL,
	`work_case_id` text,
	`requirement_contract_ref` text NOT NULL,
	`requirement_contract_version` integer NOT NULL,
	`options_json` text DEFAULT '[]' NOT NULL,
	`scope_contract_json` text DEFAULT '{}' NOT NULL,
	`payment_topology` text NOT NULL,
	`pricing_policy_name` text NOT NULL,
	`tax_decision_ref` text,
	`valid_from` text NOT NULL,
	`valid_until` text NOT NULL,
	`requires_human_review` integer DEFAULT false NOT NULL,
	`review_reason` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`work_case_id`) REFERENCES `work_cases`(`work_case_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `offer_selections` (
	`offer_id` text PRIMARY KEY NOT NULL,
	`band` text NOT NULL,
	`fulfillment_option_ref` text NOT NULL,
	`total_minor_units` integer NOT NULL,
	`currency` text DEFAULT 'CAD' NOT NULL,
	`selected_at` text NOT NULL,
	FOREIGN KEY (`offer_id`) REFERENCES `commercial_offers`(`offer_id`) ON UPDATE no action ON DELETE no action
);
