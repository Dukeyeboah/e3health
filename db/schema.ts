import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const products = sqliteTable('products', { id: text('id').primaryKey(), owner: text('owner').notNull(), data: text('data').notNull() });
