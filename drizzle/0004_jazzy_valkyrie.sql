CREATE TABLE `document_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`job_id` integer NOT NULL,
	`quote_id` integer,
	`owner_email` text NOT NULL,
	`contractor_email` text,
	`document_type` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'generated' NOT NULL,
	`content` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `job_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_records_external_unique` ON `document_records` (`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `document_records_job_type_unique` ON `document_records` (`job_id`,`document_type`);--> statement-breakpoint
CREATE INDEX `document_records_owner_idx` ON `document_records` (`owner_email`);--> statement-breakpoint
CREATE INDEX `document_records_contractor_idx` ON `document_records` (`contractor_email`);