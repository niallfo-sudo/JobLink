ALTER TABLE `contractor_profiles` ADD `business_address` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `contractor_profiles` ADD `years_in_business` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `contractor_profiles` ADD `stripe_connect_account_id` text;--> statement-breakpoint
ALTER TABLE `contractor_profiles` ADD `payouts_enabled` integer DEFAULT false NOT NULL;