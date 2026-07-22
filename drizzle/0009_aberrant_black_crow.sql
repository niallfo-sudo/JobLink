CREATE TABLE `job_attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`owner_email` text NOT NULL,
	`storage_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `job_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_attachments_storage_key_unique` ON `job_attachments` (`storage_key`);--> statement-breakpoint
CREATE INDEX `job_attachments_job_created_idx` ON `job_attachments` (`job_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `job_attachments_owner_idx` ON `job_attachments` (`owner_email`);