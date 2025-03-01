import { useState } from "react";
import { ChatProvider, useChat } from "@/hooks/use-chat";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Message } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";

function ChatContent() {
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const { messages } = useChat();

  return (
    <div className="flex flex-col h-screen">
      <ChatHeader />
      
      <ScrollArea className="flex-1 p-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onReply={setReplyTo}
          />
        ))}
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
