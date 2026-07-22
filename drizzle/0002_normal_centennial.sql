CREATE TABLE `contractor_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_email` text NOT NULL,
	`business_name` text NOT NULL,
	`legal_name` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`about` text DEFAULT '' NOT NULL,
	`primary_service` text NOT NULL,
	`services` text DEFAULT '[]' NOT NULL,
	`home_base` text DEFAULT 'Hamilton, Ontario' NOT NULL,
	`service_radius_km` integer DEFAULT 30 NOT NULL,
	`team_size` integer DEFAULT 1 NOT NULL,
	`emergency_available` integer DEFAULT false NOT NULL,
	`accepting_work` integer DEFAULT true NOT NULL,
	`plan` text DEFAULT 'growth' NOT NULL,
	`verification_status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contractor_profiles_owner_unique` ON `contractor_profiles` (`owner_email`);