CREATE TABLE `operations_case_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`author_email` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `operations_cases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `operations_case_notes_case_created_idx` ON `operations_case_notes` (`case_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `operations_cases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`case_type` text NOT NULL,
	`title` text NOT NULL,
	`subject` text NOT NULL,
	`summary` text NOT NULL,
	`risk` text DEFAULT 'medium' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`assignee` text DEFAULT 'Unassigned' NOT NULL,
	`evidence_count` integer DEFAULT 0 NOT NULL,
	`due_label` text DEFAULT 'No deadline' NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`resolution` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operations_cases_external_unique` ON `operations_cases` (`external_id`);--> statement-breakpoint
CREATE INDEX `operations_cases_type_status_idx` ON `operations_cases` (`case_type`,`status`);--> statement-breakpoint
CREATE INDEX `operations_cases_priority_idx` ON `operations_cases` (`priority`);