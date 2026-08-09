ALTER TABLE `job_attachments` ADD `milestone_id` integer REFERENCES `payment_milestones`(`id`) ON DELETE cascade;
CREATE INDEX `job_attachments_milestone_idx` ON `job_attachments` (`milestone_id`);
