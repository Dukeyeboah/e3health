import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const products = sqliteTable('products', { id: text('id').primaryKey(), owner: text('owner').notNull(), data: text('data').notNull() });
export const settings = sqliteTable('settings', { key: text('key').primaryKey(), value: text('value').notNull() });

export const orders=sqliteTable('orders',{
 sequence:integer('sequence').primaryKey({autoIncrement:true}),id:text('id').notNull().unique(),submissionKey:text('submission_key').notNull().unique(),requestHash:text('request_hash').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),status:text('status').notNull().default('new'),revision:integer('revision').notNull().default(1),data:text('data').notNull()
});
