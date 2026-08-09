ALTER TABLE `quotes` ADD `final_options` text NOT NULL DEFAULT '[]';
ALTER TABLE `quotes` ADD `selected_final_option_id` text;
