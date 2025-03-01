import { ChatMessage } from "@shared/schema";

type WebSocketListener = (message: ChatMessage) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private listeners: WebSocketListener[] = [];

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    this.socket = new WebSocket(wsUrl);
    
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
      setTimeout(() => this.connect(), 1000);
    };
  }

  sendMessage(userId: number, content: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: "message",
        userId,
        content
      }));
    }
  }

  addMessageListener(listener: WebSocketListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export const wsClient = new WebSocketClient();
