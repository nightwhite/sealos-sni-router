import { pgTable, text, integer, timestamp, serial } from 'drizzle-orm/pg-core';
import { sqliteTable, integer as sqliteInteger } from 'drizzle-orm/sqlite-core';

// PostgreSQL Schema
export const pgServices = pgTable('services', {
  id: serial('id').primaryKey(),
  domain: text('domain').notNull().unique(),
  service: text('service').notNull(),
  port: integer('port').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// SQLite Schema
export const sqliteServices = sqliteTable('services', {
  id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
  domain: text('domain').notNull().unique(),
  service: text('service').notNull(),
  port: sqliteInteger('port').notNull(),
  createdAt: sqliteInteger('created_at').default(() => Date.now()),
  updatedAt: sqliteInteger('updated_at').default(() => Date.now()),
});

// Type definitions
export type Service = {
  id?: number;
  domain: string;
  service: string;
  port: number;
  createdAt?: Date | number;
  updatedAt?: Date | number;
};

