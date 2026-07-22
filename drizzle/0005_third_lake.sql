CREATE TABLE `change_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`job_id` integer NOT NULL,
	`quote_id` integer,
	`owner_email` text NOT NULL,
	`contractor_email` text NOT NULL,
	`contractor_name` text NOT NULL,
	`reason` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`schedule_impact` text DEFAULT 'No schedule impact' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decision_name` text,
	`decided_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `job_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `change_orders_external_unique` ON `change_orders` (`external_id`);--> statement-breakpoint
CREATE INDEX `change_orders_job_idx` ON `change_orders` (`job_id`);--> statement-breakpoint
CREATE INDEX `change_orders_owner_idx` ON `change_orders` (`owner_email`);--> statement-breakpoint
CREATE INDEX `change_orders_contractor_idx` ON `change_orders` (`contractor_email`);