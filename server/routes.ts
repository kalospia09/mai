import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { z } from "zod";
import { insertMessageSchema } from "@shared/schema";

interface WSClient extends WebSocket {
  userId?: number;
}

type WSMessage = {
  type: string;
  payload: any;
};

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  const httpServer = createServer(app);
  // Changed WebSocket path to avoid conflict with Vite
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/chat' });

  app.get("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const messages = await storage.getMessages();
    res.json(messages);
  });

  wss.on("connection", (ws: WSClient) => {
    console.log("New WebSocket connection established");

    ws.on("message", async (data: string) => {
      try {
        const message: WSMessage = JSON.parse(data);
        console.log("Received WebSocket message:", message.type);

        switch (message.type) {
          case "auth":
            ws.userId = message.payload.userId;
            await storage.updateUserStatus(message.payload.userId, true);
            broadcastStatus();
            break;

          case "message":
            const validatedMessage = insertMessageSchema.parse(message.payload);
            const newMessage = await storage.createMessage(validatedMessage);
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
        }
      } catch (err) {
        console.error("WebSocket error:", err);
        ws.send(JSON.stringify({ type: "error", payload: err }));
      }
    });

    ws.on("close", async () => {
      console.log("WebSocket connection closed, userId:", ws.userId);
      if (ws.userId) {
        await storage.updateUserStatus(ws.userId, false);
        await storage.updateLastSeen(ws.userId);
        broadcastStatus();
      }
    });
  });

  function broadcast(message: WSMessage) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  function broadcastStatus() {
    broadcast({ 
      type: "status_update", 
      payload: Array.from(wss.clients).map((client: WSClient) => ({
        userId: client.userId,
        isOnline: true
      }))
    });
  }

  return httpServer;
}