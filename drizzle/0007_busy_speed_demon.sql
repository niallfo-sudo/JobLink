CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipient_email` text NOT NULL,
	`job_id` integer,
	`notification_type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `job_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_recipient_created_idx` ON `notifications` (`recipient_email`,`created_at`);