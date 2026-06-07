-- CreateIndex
CREATE INDEX `transactions_date_idx` ON `transactions`(`date`);

-- CreateIndex
CREATE INDEX `transactions_created_at_idx` ON `transactions`(`created_at`);

-- RenameIndex
ALTER TABLE `items` RENAME INDEX `items_category_id_fkey` TO `items_category_id_idx`;

-- RenameIndex
ALTER TABLE `transactions` RENAME INDEX `transactions_item_id_fkey` TO `transactions_item_id_idx`;

-- RenameIndex
ALTER TABLE `transactions` RENAME INDEX `transactions_user_id_fkey` TO `transactions_user_id_idx`;
