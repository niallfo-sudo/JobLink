CREATE TABLE `support_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`requester_email` text NOT NULL,
	`job_external_id` text DEFAULT '' NOT NULL,
	`topic` text DEFAULT 'general' NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `support_requests_external_unique` ON `support_requests` (`external_id`);--> statement-breakpoint
CREATE INDEX `support_requests_requester_created_idx` ON `support_requests` (`requester_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `support_requests_status_created_idx` ON `support_requests` (`status`,`created_at`);