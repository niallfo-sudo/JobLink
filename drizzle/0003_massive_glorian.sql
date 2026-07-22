CREATE TABLE `payment_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`quote_id` integer NOT NULL,
	`owner_email` text NOT NULL,
	`contractor_email` text,
	`contractor_name` text NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`customer_fee_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`contractor_payout_cents` integer NOT NULL,
	`currency` text DEFAULT 'cad' NOT NULL,
	`status` text DEFAULT 'processor_setup_required' NOT NULL,
	`processor` text DEFAULT 'unconfigured' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `job_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_records_job_unique` ON `payment_records` (`job_id`);--> statement-breakpoint
CREATE INDEX `payment_records_owner_idx` ON `payment_records` (`owner_email`);--> statement-breakpoint
CREATE INDEX `payment_records_contractor_idx` ON `payment_records` (`contractor_email`);