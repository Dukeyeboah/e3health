CREATE TABLE `orders` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`submission_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_id_unique` ON `orders` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_submission_key_unique` ON `orders` (`submission_key`);