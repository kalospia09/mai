import { useState, useRef, useEffect } from "react";
import { ChatProvider, useChat } from "@/hooks/use-chat";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Message } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";

function ChatContent() {
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const { messages } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-background">
      <ChatHeader />

      <ScrollArea 
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto"
      >
        <div className="space-y-1">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onReply={setReplyTo}
            />
          ))}
        </div>
      </ScrollArea>

      <ChatInput
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <ChatProvider>
      <ChatContent />
    </ChatProvider>
  );
}