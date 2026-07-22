CREATE TABLE `verified_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`owner_email` text NOT NULL,
	`contractor_email` text NOT NULL,
	`contractor_name` text NOT NULL,
	`workmanship` integer NOT NULL,
	`communication` integer NOT NULL,
	`punctuality` integer NOT NULL,
	`cleanliness` integer NOT NULL,
	`average_score` integer NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `job_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verified_reviews_job_unique` ON `verified_reviews` (`job_id`);--> statement-breakpoint
CREATE INDEX `verified_reviews_contractor_idx` ON `verified_reviews` (`contractor_email`);