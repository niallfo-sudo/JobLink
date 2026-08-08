ALTER TABLE `payment_records` ADD `released_cents` integer NOT NULL DEFAULT 0;
CREATE TABLE `payment_milestones` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `payment_id` integer NOT NULL,
  `job_id` integer NOT NULL,
  `milestone_type` text NOT NULL,
  `label` text NOT NULL,
  `amount_cents` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'awaiting_funding',
  `proof_note` text NOT NULL DEFAULT '',
  `proof_submitted_at` integer,
  `homeowner_approved_at` integer,
  `released_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`payment_id`) REFERENCES `payment_records`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`job_id`) REFERENCES `job_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `payment_milestones_payment_type_unique` ON `payment_milestones` (`payment_id`,`milestone_type`);
CREATE INDEX `payment_milestones_payment_status_idx` ON `payment_milestones` (`payment_id`,`status`);
CREATE INDEX `payment_milestones_job_idx` ON `payment_milestones` (`job_id`);
