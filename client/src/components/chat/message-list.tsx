import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage } from "@shared/schema";
import { format } from "date-fns";

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId?: number;
}

export function MessageList({ messages, currentUserId }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex flex-col ${
              message.userId === currentUserId ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.userId === currentUserId
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary"
              }`}
            >
              <div className="text-sm font-medium mb-1">{message.username}</div>
              <div className="break-words">{message.content}</div>
              <div className="text-xs opacity-70 mt-1">
                {format(new Date(message.createdAt), "p")}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
