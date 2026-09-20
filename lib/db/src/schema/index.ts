import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const warungStates = pgTable("warung_states", {
  userId: text("user_id").primaryKey(),
  state: jsonb("state").$type<Record<string, unknown>>().notNull(),
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type WarungStateRecord = typeof warungStates.$inferSelect;