import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "./use-auth";
import { Message } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

type ChatContextType = {
  messages: Message[];
  sendMessage: (content: string, replyToId?: number, mediaUrl?: string) => void;
  markAsRead: (messageId: number) => void;
  deleteMessage: (messageId: number) => void;
  setTyping: (isTyping: boolean) => void;
  onlineUsers: number[];
  typingUsers: number[];
  statusData: Array<{ userId: number; isOnline: boolean; lastSeen: string | null }>;
};

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const [typingUsers, setTypingUsers] = useState<number[]>([]);
  const [statusData, setStatusData] = useState<ChatContextType['statusData']>([]);
  const messageQueue = useRef<Set<string>>(new Set());

  const token = localStorage.getItem('authToken');

  const { data: initialMessages } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
    enabled: !!user && !!token,
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0] as string, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    }
  });

  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // Handle window focus/blur with RAF for better accuracy
  useEffect(() => {
    let focused = true;
    let rafId: number;

    const checkFocus = () => {
      const isVisible = !document.hidden;
      if (focused !== isVisible) {
        focused = isVisible;
        if (socket && user) {
          socket.send(JSON.stringify({
            type: "status_update",
            payload: { isOnline: isVisible }
          }));
        }
      }
      rafId = requestAnimationFrame(checkFocus);
    };

    checkFocus();
    document.addEventListener('visibilitychange', checkFocus);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', checkFocus);
    };
  }, [socket, user]);

  // Mark messages as read when visible and focused
  useEffect(() => {
    if (!document.hidden && user && socket) {
      const unreadMessages = messages.filter(
        msg => msg.senderId !== user.id && !msg.isRead
      );

      unreadMessages.forEach(msg => {
        socket.send(JSON.stringify({
          type: "read",
          payload: { messageId: msg.id }
        }));
      });
    }
  }, [messages, user, socket, document.hidden]);

  useEffect(() => {
    if (!user || !token) {
      if (socket) {
        socket.close();
        setSocket(null);
      }
      return;
    }

    let reconnectTimer: ReturnType<typeof setTimeout>;
    const maxReconnectAttempts = 5;
    let reconnectAttempts = 0;

    const connectWebSocket = () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.error("Max reconnection attempts reached");
        return;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/chat`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket connection established");
        reconnectAttempts = 0;
        ws.send(JSON.stringify({ 
          type: "auth", 
          token,
          payload: { 
            userId: user.id,
            isOnline: !document.hidden
          } 
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "new_message":
            // Prevent duplicate messages
            if (!messageQueue.current.has(data.payload.id)) {
              setMessages(prev => [...prev, data.payload]);
              if (!document.hidden && data.payload.senderId !== user.id) {
                ws.send(JSON.stringify({
                  type: "read",
                  payload: { messageId: data.payload.id }
                }));
              }
            }
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
            setStatusData(data.payload);
            setOnlineUsers(data.payload
              .filter((status: any) => status.isOnline)
              .map((status: any) => status.userId)
            );
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
            if (data.payload === "Not authenticated" || data.payload === "Invalid token") {
              ws.close();
              setSocket(null);
            }
            break;
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = (event) => {
        console.log("WebSocket connection closed", event.code, event.reason);

        if (user && token) {
          reconnectAttempts++;
          console.log(`Reconnection attempt ${reconnectAttempts} of ${maxReconnectAttempts}`);

          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          reconnectTimer = setTimeout(() => {
            setSocket(null);
          }, delay);
        }
      };

      setSocket(ws);
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimer);
      if (socket) {
        socket.close();
      }
    };
  }, [user, token, socket === null]);

  const sendMessage = useCallback((content: string, replyToId?: number, mediaUrl?: string) => {
    if (!socket || !user) return;

    const messageId = Date.now().toString();
    messageQueue.current.add(messageId);

    socket.send(JSON.stringify({
      type: "message",
      payload: {
        id: messageId,
        senderId: user.id,
        content,
        replyToId,
        mediaUrl
      }
    }));

    // Clean up message queue after a delay
    setTimeout(() => {
      messageQueue.current.delete(messageId);
    }, 5000);
  }, [socket, user]);

  const markAsRead = useCallback((messageId: number) => {
    if (!socket) return;
    socket.send(JSON.stringify({
      type: "read",
      payload: { messageId }
    }));
  }, [socket]);

  const deleteMessage = useCallback((messageId: number) => {
    if (!socket) return;
    socket.send(JSON.stringify({
      type: "delete",
      payload: { messageId }
    }));
  }, [socket]);

  const setTyping = useCallback((isTyping: boolean) => {
    if (!socket || !user) return;
    socket.send(JSON.stringify({
      type: "typing",
      payload: { isTyping }
    }));
  }, [socket, user]);

  return (
    <ChatContext.Provider value={{
      messages,
      sendMessage,
      markAsRead,
      deleteMessage,
      setTyping,
      onlineUsers,
      typingUsers,
      statusData
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