CREATE TABLE `agreement_signatures` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `document_id` integer NOT NULL,
  `job_id` integer NOT NULL,
  `signer_email` text NOT NULL,
  `signer_role` text NOT NULL,
  `signer_name` text NOT NULL,
  `consent_text` text NOT NULL,
  `signing_method` text NOT NULL DEFAULT 'account_attestation',
  `user_agent` text NOT NULL DEFAULT '',
  `signed_at` integer NOT NULL,
  FOREIGN KEY (`document_id`) REFERENCES `document_records`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`job_id`) REFERENCES `job_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `agreement_signatures_document_role_unique` ON `agreement_signatures` (`document_id`,`signer_role`);
CREATE INDEX `agreement_signatures_job_idx` ON `agreement_signatures` (`job_id`);
CREATE INDEX `agreement_signatures_signer_idx` ON `agreement_signatures` (`signer_email`);
