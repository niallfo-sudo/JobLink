CREATE TABLE `job_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`label` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `job_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `job_events_job_created_idx` ON `job_events` (`job_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `job_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`size` text DEFAULT 'Not specified' NOT NULL,
	`timeline` text DEFAULT 'Flexible' NOT NULL,
	`budget` text DEFAULT 'Need guidance' NOT NULL,
	`postal_code` text DEFAULT '' NOT NULL,
	`emergency` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'matching' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_requests_external_id_unique` ON `job_requests` (`external_id`);--> statement-breakpoint
CREATE INDEX `job_requests_owner_created_idx` ON `job_requests` (`owner_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `job_requests_status_idx` ON `job_requests` (`status`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`sender_email` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `job_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_job_created_idx` ON `messages` (`job_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`contractor_name` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`available_at` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `job_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quotes_job_idx` ON `quotes` (`job_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'homeowner' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);