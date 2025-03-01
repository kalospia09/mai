import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  replyToId: integer("reply_to_id").references(() => messages.id),
  mediaUrl: text("media_url"),
  isRead: boolean("is_read").default(false).notNull(),
  isDeleted: boolean("is_deleted").default(false).notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  content: true,
  userId: true,
  replyToId: true,
  mediaUrl: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type User = typeof users.$inferSelect;
export type Message = typeof messages.$inferSelect;

export type ChatMessage = Message & {
  username: string;
};