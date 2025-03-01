import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { z } from "zod";
import { insertMessageSchema } from "@shared/schema";

interface WSClient extends WebSocket {
  userId?: number;
  isAlive?: boolean;
}

type WSMessage = {
  type: string;
  payload: any;
  token?: string;
};

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/chat' });

  app.get("/api/messages", async (req, res) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.sendStatus(401);
    }

    const user = await storage.getUserByToken(token);
    if (!user) {
      return res.sendStatus(401);
    }

    const messages = await storage.getMessages();
    res.json(messages);
  });

  function heartbeat(ws: WSClient) {
    ws.isAlive = true;
  }

  const interval = setInterval(() => {
    wss.clients.forEach((ws: WSClient) => {
      if (ws.isAlive === false) {
        console.log("Terminating inactive connection");
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', function close() {
    clearInterval(interval);
  });

  async function broadcastStatus() {
    // Get all users and their status
    const allUsers = await Promise.all([1, 2].map(async (id) => {
      const user = await storage.getUser(id);
      return {
        userId: id,
        isOnline: Array.from(wss.clients).some(
          (client: WSClient) => client.userId === id
        ),
        lastSeen: user?.lastSeen
      };
    }));

    broadcast({ 
      type: "status_update", 
      payload: allUsers
    });
  }

  wss.on("connection", (ws: WSClient) => {
    console.log("New WebSocket connection established");

    ws.isAlive = true;
    ws.on('pong', () => heartbeat(ws));

    ws.on("message", async (data: string) => {
      try {
        const message: WSMessage = JSON.parse(data);
        console.log("Received WebSocket message:", message.type);

        // Handle auth separately as it needs the token
        if (message.type === "auth") {
          const token = message.token;
          if (!token) {
            console.log("WebSocket auth failed - No token provided");
            ws.send(JSON.stringify({ type: "error", payload: "No token provided" }));
            ws.close();
            return;
          }

          const user = await storage.getUserByToken(token);
          if (!user) {
            console.log("WebSocket auth failed - Invalid token");
            ws.send(JSON.stringify({ type: "error", payload: "Invalid token" }));
            ws.close();
            return;
          }

          ws.userId = user.id;
          await storage.updateUserStatus(user.id, true);
          console.log("WebSocket auth successful - User:", user.id);
          await broadcastStatus(); // Broadcast status immediately after successful auth
          return;
        }

        // All other messages require authentication
        if (!ws.userId) {
          console.log("WebSocket message rejected - Not authenticated");
          ws.send(JSON.stringify({ type: "error", payload: "Not authenticated" }));
          return;
        }

        switch (message.type) {
          case "message":
            const validatedMessage = insertMessageSchema.parse(message.payload);
            const newMessage = await storage.createMessage(validatedMessage);
            console.log("New message created:", newMessage.id);
            broadcast({ type: "new_message", payload: newMessage });
            break;

          case "typing":
            broadcast({ 
              type: "typing", 
              payload: { userId: ws.userId, isTyping: message.payload.isTyping } 
            });
            break;

          case "read":
            await storage.markMessageAsRead(message.payload.messageId);
            broadcast({ type: "message_read", payload: message.payload });
            break;

          case "delete":
            await storage.deleteMessage(message.payload.messageId);
            broadcast({ type: "message_deleted", payload: message.payload });
            break;

          case "status_update":
            await storage.updateUserStatus(ws.userId, message.payload.isOnline);
            if (!message.payload.isOnline) {
              await storage.updateLastSeen(ws.userId);
            }
            await broadcastStatus();
            break;
        }
      } catch (err) {
        console.error("WebSocket error:", err);
        ws.send(JSON.stringify({ 
          type: "error", 
          payload: err instanceof Error ? err.message : "Unknown error" 
        }));
      }
    });

    ws.on("close", async () => {
      console.log("WebSocket connection closed - User:", ws.userId);
      if (ws.userId) {
        await storage.updateUserStatus(ws.userId, false);
        await storage.updateLastSeen(ws.userId);
        await broadcastStatus(); // Broadcast status immediately after disconnection
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error occurred:", error);
    });
  });

  function broadcast(message: WSMessage) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  return httpServer;
}