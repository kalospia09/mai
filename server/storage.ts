import { User, Message, InsertUser, InsertMessage } from "@shared/schema";
import { randomBytes } from "crypto";

// Predefined users
const PREDEFINED_USERS: User[] = [
  {
    id: 1,
    username: "user1",
    password: "1",
    authToken: null,
    lastSeen: new Date(),
    isOnline: false,
  },
  {
    id: 2,
    username: "user2",
    password: "2",
    authToken: null,
    lastSeen: new Date(),
    isOnline: false,
  }
];

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByToken(token: string): Promise<User | undefined>;
  generateUserToken(id: number): Promise<string>;
  updateUserStatus(id: number, isOnline: boolean): Promise<void>;
  updateLastSeen(id: number): Promise<void>;

  getMessages(): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: number): Promise<void>;
  deleteMessage(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private messages: Map<number, Message>;

  constructor() {
    this.users = new Map();
    this.messages = new Map();

    // Initialize with predefined users
    PREDEFINED_USERS.forEach(user => {
      this.users.set(user.id, user);
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByToken(token: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.authToken === token,
    );
  }

  async generateUserToken(id: number): Promise<string> {
    const user = await this.getUser(id);
    if (user) {
      const token = randomBytes(32).toString('hex');
      this.users.set(id, { ...user, authToken: token });
      return token;
    }
    throw new Error("User not found");
  }

  async updateUserStatus(id: number, isOnline: boolean): Promise<void> {
    const user = await this.getUser(id);
    if (user) {
      this.users.set(id, { ...user, isOnline });
    }
  }

  async updateLastSeen(id: number): Promise<void> {
    const user = await this.getUser(id);
    if (user) {
      this.users.set(id, { ...user, lastSeen: new Date() });
    }
  }

  async getMessages(): Promise<Message[]> {
    return Array.from(this.messages.values());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = 100 + this.messages.size; // Start message IDs from 100
    const message: Message = {
      id,
      timestamp: new Date(),
      isRead: false,
      isDeleted: false,
      ...insertMessage,
    };
    this.messages.set(id, message);
    return message;
  }

  async markMessageAsRead(id: number): Promise<void> {
    const message = this.messages.get(id);
    if (message) {
      this.messages.set(id, { ...message, isRead: true });
    }
  }

  async deleteMessage(id: number): Promise<void> {
    const message = this.messages.get(id);
    if (message) {
      this.messages.set(id, { ...message, isDeleted: true });
    }
  }
}

export const storage = new MemStorage();