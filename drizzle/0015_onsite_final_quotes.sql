ALTER TABLE `quotes` ADD `onsite_visit_at` integer;
ALTER TABLE `quotes` ADD `work_description` text NOT NULL DEFAULT '';
ALTER TABLE `quotes` ADD `materials` text NOT NULL DEFAULT '';
ALTER TABLE `quotes` ADD `measurements` text NOT NULL DEFAULT '';
ALTER TABLE `quotes` ADD `deposit_cents` integer NOT NULL DEFAULT 0;
ALTER TABLE `quotes` ADD `progress_cents` integer NOT NULL DEFAULT 0;
ALTER TABLE `quotes` ADD `completion_cents` integer NOT NULL DEFAULT 0;
ALTER TABLE `quotes` ADD `finalized_at` integer;
