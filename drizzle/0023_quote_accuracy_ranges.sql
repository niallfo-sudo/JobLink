ALTER TABLE `quotes` ADD `initial_min_cents` integer NOT NULL DEFAULT 0;
ALTER TABLE `quotes` ADD `initial_max_cents` integer NOT NULL DEFAULT 0;
ALTER TABLE `quotes` ADD `quote_accuracy_delta` integer NOT NULL DEFAULT 0;
ALTER TABLE `quotes` ADD `quote_accuracy_status` text NOT NULL DEFAULT 'pending';
