import { User, Message, InsertUser, InsertMessage } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// Predefined users
const PREDEFINED_USERS: User[] = [
  {
    id: 1,
    username: "user1",
    password: "1",
    lastSeen: new Date(),
    isOnline: false,
  },
  {
    id: 2,
    username: "user2",
    password: "2",
    lastSeen: new Date(),
    isOnline: false,
  }
];

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  updateUserStatus(id: number, isOnline: boolean): Promise<void>;
  updateLastSeen(id: number): Promise<void>;

  getMessages(): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: number): Promise<void>;
  deleteMessage(id: number): Promise<void>;

  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private messages: Map<number, Message>;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.messages = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });

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
    const id = 100 + this.messages.size; //Start message IDs from 100
    const message: Message = {
      ...insertMessage,
      id,
      timestamp: new Date(),
      isRead: false,
      isDeleted: false
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

  private currentId = 100; // Start message IDs from 100
}

export const storage = new MemStorage();