ALTER TABLE `quotes` ADD `contractor_email` text;--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_job_contractor_unique` ON `quotes` (`job_id`,`contractor_email`);