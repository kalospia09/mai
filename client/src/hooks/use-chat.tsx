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
};

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const [typingUsers, setTypingUsers] = useState<number[]>([]);
  const messageQueue = useRef<Set<string>>(new Set());
  const documentFocused = useRef<boolean>(document.hasFocus());
  const documentVisible = useRef<boolean>(!document.hidden);

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

  // Handle window focus and visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      documentVisible.current = !document.hidden;
      updateUserStatus();
    };

    const handleFocusChange = () => {
      documentFocused.current = document.hasFocus();
      updateUserStatus();
    };

    const updateUserStatus = () => {
      const isActive = documentVisible.current && documentFocused.current;
      if (socket && user) {
        socket.send(JSON.stringify({
          type: "status_update",
          payload: { isOnline: isActive }
        }));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocusChange);
    window.addEventListener('blur', handleFocusChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocusChange);
      window.removeEventListener('blur', handleFocusChange);
    };
  }, [socket, user]);

  // Check read status periodically when window is active
  useEffect(() => {
    const checkReadStatus = () => {
      const isActive = documentVisible.current && documentFocused.current;
      if (isActive && user && socket) {
        const unreadMessages = messages.filter(
          msg => msg.senderId !== user.id && !msg.isRead
        );

        if (unreadMessages.length > 0) {
          unreadMessages.forEach(msg => {
            socket.send(JSON.stringify({
              type: "read",
              payload: { messageId: msg.id }
            }));
          });
        }
      }
    };

    const interval = setInterval(checkReadStatus, 1000);

    // Also check when visibility or focus changes
    const handleStateChange = () => {
      if (documentVisible.current && documentFocused.current) {
        checkReadStatus();
      }
    };

    document.addEventListener('visibilitychange', handleStateChange);
    window.addEventListener('focus', handleStateChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleStateChange);
      window.removeEventListener('focus', handleStateChange);
    };
  }, [messages, user, socket]);

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
            isOnline: documentVisible.current && documentFocused.current
          } 
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "new_message":
            if (!messageQueue.current.has(data.payload.id)) {
              messageQueue.current.add(data.payload.id);
              setMessages(prev => [...prev, data.payload]);
              const isActive = documentVisible.current && documentFocused.current;
              if (isActive && data.payload.senderId !== user.id) {
                socket.send(JSON.stringify({
                  type: "read",
                  payload: { messageId: data.payload.id }
                }));
              }
              setTimeout(() => {
                messageQueue.current.delete(data.payload.id);
              }, 5000);
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
  }, [socket, user]);

  const markAsRead = useCallback((messageId: number) => {
    if (!socket || !documentVisible.current || !documentFocused.current) return;
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