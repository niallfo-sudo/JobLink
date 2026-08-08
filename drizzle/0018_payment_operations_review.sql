ALTER TABLE `payment_milestones` ADD `operations_reviewed_by` text;
ALTER TABLE `payment_milestones` ADD `operations_reviewed_at` integer;
ALTER TABLE `payment_milestones` ADD `operations_note` text NOT NULL DEFAULT '';
CREATE INDEX `payment_milestones_operations_review_idx` ON `payment_milestones` (`status`,`operations_reviewed_at`);
