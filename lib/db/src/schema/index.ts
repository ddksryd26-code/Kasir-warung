import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const warungStates = pgTable("warung_states", {
  userId: text("user_id").primaryKey(),
  state: jsonb("state").$type<Record<string, unknown>>().notNull(),
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const googleDriveConnections = pgTable("google_drive_connections", {
  userId: text("user_id").primaryKey(),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  encryptedAccessToken: text("encrypted_access_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type WarungStateRecord = typeof warungStates.$inferSelect;
export type GoogleDriveConnectionRecord = typeof googleDriveConnections.$inferSelect;