import { ChatMessage } from "@shared/schema";

type WebSocketListener = (message: ChatMessage) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private listeners: WebSocketListener[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private maxReconnectAttempts = 5;
  private reconnectAttempts = 0;

  connect(token: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log("WebSocket connection established");
      this.reconnectAttempts = 0;
      this.socket?.send(JSON.stringify({ type: "auth", token }));
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message") {
          this.listeners.forEach(listener => listener(data.message));
        }
      } catch (err) {
        console.error("WebSocket message parsing error:", err);
      }
    };

    this.socket.onclose = () => {
      console.log("WebSocket connection closed");

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }

      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

      this.reconnectTimer = setTimeout(() => {
        this.connect(token);
      }, delay);
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  sendMessage(userId: number, content: string, replyToId?: number, mediaUrl?: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: "message",
        payload: {
          userId,
          content,
          replyToId,
          mediaUrl
        }
      }));
    }
  }

  markAsRead(messageId: number) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: "read",
        payload: { messageId }
      }));
    }
  }

  deleteMessage(messageId: number) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: "delete",
        payload: { messageId }
      }));
    }
  }

  setTyping(isTyping: boolean) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: "typing",
        payload: { isTyping }
      }));
    }
  }

  addMessageListener(listener: WebSocketListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export const wsClient = new WebSocketClient();