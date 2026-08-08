CREATE TABLE `contractor_verification_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_email` text NOT NULL,
	`document_type` text NOT NULL,
	`storage_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`uploaded_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contractor_verification_owner_type_unique` ON `contractor_verification_documents` (`owner_email`,`document_type`);--> statement-breakpoint
CREATE INDEX `contractor_verification_owner_idx` ON `contractor_verification_documents` (`owner_email`);--> statement-breakpoint
ALTER TABLE `contractor_profiles` ADD `subscription_status` text DEFAULT 'inactive' NOT NULL;--> statement-breakpoint
ALTER TABLE `contractor_profiles` ADD `stripe_customer_id` text;--> statement-breakpoint
ALTER TABLE `contractor_profiles` ADD `stripe_subscription_id` text;