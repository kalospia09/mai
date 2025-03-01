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

  wss.on("connection", (ws: WSClient) => {
    console.log("New WebSocket connection established");

    ws.isAlive = true;
    ws.on('pong', () => heartbeat(ws));

    ws.on("message", async (data: string) => {
      try {
        const message: WSMessage = JSON.parse(data);
        console.log("Received WebSocket message:", message.type);

        switch (message.type) {
          case "auth":
            const userId = message.payload.userId;
            const user = await storage.getUser(userId);
            if (!user) {
              console.log("WebSocket auth failed - Invalid user:", userId);
              ws.send(JSON.stringify({ type: "error", payload: "Invalid user" }));
              ws.close();
              return;
            }
            ws.userId = userId;
            await storage.updateUserStatus(userId, true);
            console.log("WebSocket auth successful - User:", userId);
            broadcastStatus();
            break;

          case "message":
            if (!ws.userId) {
              console.log("WebSocket message rejected - Not authenticated");
              ws.send(JSON.stringify({ type: "error", payload: "Not authenticated" }));
              return;
            }
            const validatedMessage = insertMessageSchema.parse(message.payload);
            const newMessage = await storage.createMessage(validatedMessage);
            console.log("New message created:", newMessage.id);
            broadcast({ type: "new_message", payload: newMessage });
            break;

          case "typing":
            if (!ws.userId) {
              console.log("WebSocket typing rejected - Not authenticated");
              ws.send(JSON.stringify({ type: "error", payload: "Not authenticated" }));
              return;
            }
            broadcast({ 
              type: "typing", 
              payload: { userId: ws.userId, isTyping: message.payload.isTyping } 
            });
            break;

          case "read":
            if (!ws.userId) {
              console.log("WebSocket read status rejected - Not authenticated");
              ws.send(JSON.stringify({ type: "error", payload: "Not authenticated" }));
              return;
            }
            await storage.markMessageAsRead(message.payload.messageId);
            broadcast({ type: "message_read", payload: message.payload });
            break;

          case "delete":
            if (!ws.userId) {
              console.log("WebSocket delete rejected - Not authenticated");
              ws.send(JSON.stringify({ type: "error", payload: "Not authenticated" }));
              return;
            }
            await storage.deleteMessage(message.payload.messageId);
            broadcast({ type: "message_deleted", payload: message.payload });
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
      console.log("WebSocket connection closed, userId:", ws.userId);
      if (ws.userId) {
        await storage.updateUserStatus(ws.userId, false);
        await storage.updateLastSeen(ws.userId);
        broadcastStatus();
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