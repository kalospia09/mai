import { users, messages, type User, type InsertUser, type Message, type InsertMessage, type ChatMessage } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getMessages(): Promise<ChatMessage[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(messageId: number): Promise<Message>;
  deleteMessage(messageId: number): Promise<Message>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private messages: Map<number, Message>;
  private currentUserId: number;
  private currentMessageId: number;

  constructor() {
    this.users = new Map();
    this.messages = new Map();
    this.currentUserId = 1;
    this.currentMessageId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getMessages(): Promise<ChatMessage[]> {
    return Array.from(this.messages.values())
      .filter(msg => !msg.isDeleted)
      .map(msg => {
        const user = this.users.get(msg.userId);
        return {
          ...msg,
          username: user?.username || 'Unknown'
        };
      })
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const message: Message = {
      ...insertMessage,
      id,
      createdAt: new Date(),
      isRead: false,
      isDeleted: false,
    };
    this.messages.set(id, message);
    return message;
  }

  async markMessageAsRead(messageId: number): Promise<Message> {
    const message = this.messages.get(messageId);
    if (!message) throw new Error("Message not found");

    const updatedMessage = { ...message, isRead: true };
    this.messages.set(messageId, updatedMessage);
    return updatedMessage;
  }

  async deleteMessage(messageId: number): Promise<Message> {
    const message = this.messages.get(messageId);
    if (!message) throw new Error("Message not found");

    const updatedMessage = { ...message, isDeleted: true };
    this.messages.set(messageId, updatedMessage);
    return updatedMessage;
  }
}

export const storage = new MemStorage();