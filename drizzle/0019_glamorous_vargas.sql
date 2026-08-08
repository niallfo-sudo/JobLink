ALTER TABLE `contractor_profiles` ADD `approved_services` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
UPDATE `contractor_profiles` SET `approved_services` = `services` WHERE `verification_status` = 'verified';
