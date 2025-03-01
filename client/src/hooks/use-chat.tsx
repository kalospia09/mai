import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./use-auth";
import { Message, User } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

type ChatContextType = {
  messages: Message[];
  sendMessage: (content: string, replyToId?: number, mediaUrl?: string) => void;
  markAsRead: (messageId: number) => void;
  deleteMessage: (messageId: number) => void;
  setTyping: (isTyping: boolean) => void;
  onlineUsers: number[];
  typingUsers: number[];
};

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const [typingUsers, setTypingUsers] = useState<number[]>([]);

  const { data: initialMessages } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
    enabled: !!user // Only fetch messages when user is authenticated
  });

  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  useEffect(() => {
    // Only establish WebSocket connection if user is authenticated
    if (!user) {
      if (socket) {
        socket.close();
        setSocket(null);
      }
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connection established");
      // Send auth message immediately after connection
      ws.send(JSON.stringify({ type: "auth", payload: { userId: user.id } }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Received WebSocket message:", data.type);

      switch (data.type) {
        case "new_message":
          setMessages(prev => [...prev, data.payload]);
          break;
        case "message_read":
          setMessages(prev => 
            prev.map(msg => 
              msg.id === data.payload.messageId ? { ...msg, isRead: true } : msg
            )
          );
          break;
        case "message_deleted":
          setMessages(prev => 
            prev.map(msg => 
              msg.id === data.payload.messageId ? { ...msg, isDeleted: true } : msg
            )
          );
          break;
        case "status_update":
          setOnlineUsers(data.payload.map((u: any) => u.userId));
          break;
        case "typing":
          if (data.payload.isTyping) {
            setTypingUsers(prev => [...prev, data.payload.userId]);
          } else {
            setTypingUsers(prev => prev.filter(id => id !== data.payload.userId));
          }
          break;
        case "error":
          console.error("WebSocket error from server:", data.payload);
          break;
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
      // Attempt to reconnect after a delay if user is still authenticated
      if (user) {
        setTimeout(() => {
          setSocket(null); // This will trigger a reconnect
        }, 5000);
      }
    };

    setSocket(ws);

    return () => {
      console.log("Cleaning up WebSocket connection");
      ws.close();
    };
  }, [user, socket === null]); // Reconnect if socket is null and user is authenticated

  const sendMessage = (content: string, replyToId?: number, mediaUrl?: string) => {
    if (!socket || !user) return;

    socket.send(JSON.stringify({
      type: "message",
      payload: {
        senderId: user.id,
        content,
        replyToId,
        mediaUrl
      }
    }));
  };

  const markAsRead = (messageId: number) => {
    if (!socket) return;
    socket.send(JSON.stringify({
      type: "read",
      payload: { messageId }
    }));
  };

  const deleteMessage = (messageId: number) => {
    if (!socket) return;
    socket.send(JSON.stringify({
      type: "delete",
      payload: { messageId }
    }));
  };

  const setTyping = (isTyping: boolean) => {
    if (!socket || !user) return;
    socket.send(JSON.stringify({
      type: "typing",
      payload: { isTyping }
    }));
  };

  return (
    <ChatContext.Provider value={{
      messages,
      sendMessage,
      markAsRead,
      deleteMessage,
      setTyping,
      onlineUsers,
      typingUsers
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}